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

        let tags = (await browser.execute(getTags)).value;
        let problems = {};

        for (tag of tags) {
            await browser.url(tag.url);
            let tagProblems = (await browser.execute(getProblems)).value;

            for (let tagProblem of tagProblems) {
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
    // ul.list-group:has(span:contains("Tag")) a
    return $('span:contains("Tag")')
        .closest('ul.list-group')
        .children('a')
        .map((_, tagNode) => ({
            name: $(tagNode).children('small')[0].innerText,
            url: tagNode.href,
        }))
        .get();
}

function getProblems() {
    return $('table#question_list tbody tr')
        .map((_, problemNode) => {
            let columns = $(problemNode).children('td');
            let titleColumn = columns.eq(2);

            let titleNode = titleColumn.children('a')[0];
            let categoryDivs = titleColumn.children('div.tags');
            let tags = categoryDivs.eq(0).children('a').map((_, tagNode) => tagNode.innerText).get();
            let companies = categoryDivs.eq(1).children('a').map((_, tagNode) => tagNode.innerText).get();

            return {
                id: parseInt(columns[1].innerText),
                title: titleNode.innerText,
                url: titleNode.href,
                acceptance: parseFloat(columns[3].innerText) / 100,
                difficulty: columns[4].innerText,
                frequency: parseFloat(columns.eq(5).attr('data-frequency')),
                premiumOnly: titleColumn.children('i.fa').length > 0,
                tags: tags,
                companies: companies,
            };
        });
}

main();
