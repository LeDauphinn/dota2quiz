const fs = require('fs');
const cheerio = require('cheerio');

async function scrapeAll() {
    console.log('Fetching category members...');
    let pages = [];
    let url = 'https://dota2.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Responses&cmlimit=500&format=json';

    let hasMore = true;
    while (hasMore) {
        const res = await fetch(url);
        const data = await res.json();
        pages.push(...data.query.categorymembers);
        if (data.continue) {
            url = `https://dota2.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Responses&cmlimit=500&format=json&cmcontinue=${data.continue.cmcontinue}`;
        } else {
            hasMore = false;
        }
    }

    const titles = pages.map(p => p.title).filter(t => t.includes('Responses'));
    console.log(`Found ${titles.length} pages. Starting extraction...`);

    const db = [];

    // Process in batches of 5 to avoid overloading
    const batchSize = 5;
    for (let i = 0; i < titles.length; i += batchSize) {
        const batch = titles.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(titles.length / batchSize)}...`);

        await Promise.all(batch.map(async (title) => {
            try {
                const res = await fetch(`https://dota2.fandom.com/api.php?action=parse&page=${encodeURIComponent(title)}&format=json`);
                const data = await res.json();
                if (!data.parse) return; // Sometimes page is missing
                const html = data.parse.text['*'];
                const $ = cheerio.load(html);

                const heroName = title.replace('/Responses', '');
                const heroLines = [];

                $('li').each((_, el) => {
                    const audioSrc = $(el).find('audio source').attr('src');
                    if (audioSrc) {
                        // remove the span/a that contains "Link▶"
                        // Fandom class might be .smw-audio or similar. We can just clone the element, remove any a tags or span tags with specific classes.
                        // Or simply replace the known literal string.
                        let text = $(el).text();
                        text = text.replace(/Link▶️/g, '').replace(/Link/g, '').replace(/▶️/g, '').trim();
                        // Sometimes there are newlines or spaces at start
                        text = text.replace(/^\s*—\s*/, '').trim();

                        // Get hero image or icon if available (optional)

                        if (text.length > 0) {
                            heroLines.push({ audio: audioSrc, text });
                        }
                    }
                });

                if (heroLines.length > 0) {
                    db.push({ hero: heroName, lines: heroLines });
                }
            } catch (err) {
                console.error(`Error processing ${title}:`, err);
            }
        }));
    }

    console.log(`Extraction complete. Total heroes/personas parsed: ${db.length}`);
    fs.writeFileSync('data.json', JSON.stringify(db));
    console.log('Saved to data.json');
}

scrapeAll();
