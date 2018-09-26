let fs = require('fs');
let webdriverio = require('webdriverio');

async function main() {
    let leetcode_metadata = await scrape();

    fs.writeFileSync('build/leetcode.json', JSON.stringify(leetcode_metadata, null, 4));
}

async function scrape() {
    let options = {
        desiredCapabilities: {
            browserName: 'chrome',
        },
    };

    let browser = webdriverio
        .remote(options)
        .init();

    try {
        await browser.url('https://leetcode.com/problemset/algorithms/');

        await trySetCookies(browser);

        let problems = {};

        await browser.waitForVisible('span.row-selector select', 5000);
        let homePageProblems = (await browser.execute(getProblemsOnHomePage)).value;

        for (homePageProblem of homePageProblems) {
            problems[homePageProblem.id] = homePageProblem;
        }

        let tags = (await browser.execute(getTags)).value;

        for (tag of tags) {
            await browser.url(tag.url);
            await browser.waitForVisible('.tags-toggl__3H2x input', 5000);
            let tagPageProblems = (await browser.execute(getProblemsOnTagPage)).value;

            for (let tagProblem of tagPageProblems) {
                problems[tagProblem.id] = tagProblem;
            }
        }

        problems = Object.values(problems);

        return {
            tags: tags,
            problems: problems,
            source: 'https://github.com/chrisxue815/leetcode_scraper.git',
        };
    }
    catch (ex) {
        console.error(ex);
    }
    finally {
        browser.end();
    }
}

async function trySetCookies(browser) {
    let configFile = 'build/config.json';

    if (fs.existsSync(configFile)) {
        let config = JSON.parse(fs.readFileSync(configFile));

        if (config && config.cookie) {
            await browser.setCookie({
                name: 'LEETCODE_SESSION',
                value: config.cookie,
            });

            await browser.refresh();
        }
    }
}

function getTags() {
    expandTags('topic');

    return $('#current-topic-tags a')
        .map((_, tagNode) => ({
            name: $.trim($(tagNode).children('span.text-sm')[0].innerText),
            url: tagNode.href,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .get();
}

function getProblemsOnHomePage() {
    $('span.row-selector select')
        .val('9007199254740991')[0]
        .dispatchEvent(new Event('change', { bubbles: true }));

    return $('div.question-list-table table tbody.reactable-data tr')
        .map((_, problemNode) => {
            let columns = $(problemNode).children('td');
            let titleColumn = columns.eq(2);

            let titleNode = titleColumn.find('a')[0];

            return {
                id: parseInt(columns[1].innerText),
                title: titleNode.innerText,
                url: titleNode.href,
                acceptance: parseFloat(columns[4].innerText) / 100,
                difficulty: columns[5].innerText,
                frequency: parseFloat(columns.eq(6).attr('value')),
                premiumOnly: titleColumn.find('i.fa').length > 0,
                tags: [],
                companies: [],
            };
        })
        .get();
}

function getProblemsOnTagPage() {
    $('.tags-toggl__3H2x input')
        .prop('checked', true)[0]
        .dispatchEvent(new Event('click', { bubbles: true }));

    return $('table.table__XKyc tbody tr')
        .map((_, problemNode) => {
            let columns = $(problemNode).children('td');
            let titleColumn = columns.eq(2);
            let tagsColumn = columns.eq(3);

            let titleNode = titleColumn.find('a')[0];
            let tags = tagsColumn.find('a').map((_, tagNode) => tagNode).get();

            return {
                id: parseInt(columns[1].innerText),
                title: titleNode.innerText,
                url: titleNode.href,
                acceptance: parseFloat(columns[4].innerText) / 100,
                difficulty: columns[5].innerText,
                frequency: parseFloat(columns.eq(6).attr('value')),
                premiumOnly: titleColumn.find('i.fa').length > 0,
                tags: tags.filter(x => x.href.includes('/tag/')).map(x => x.innerText),
                companies: tags.filter(x => x.href.includes('/company/')).map(x => x.innerText),
            };
        })
        .get();
}

main();
