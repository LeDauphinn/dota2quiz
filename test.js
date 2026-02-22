const cheerio = require('cheerio');

async function scrapeHero() {
    const res = await fetch('https://dota2.fandom.com/api.php?action=parse&page=Abaddon/Responses&format=json');
    const data = await res.json();
    const html = data.parse.text['*'];
    const $ = cheerio.load(html);

    const voicelines = [];

    // The fandom wiki mostly uses <li> tags for voice lines. 
    // Usually they have a <audio> element or similar inside <li>
    $('li').each((i, el) => {
        const audio = $(el).find('audio source').attr('src');
        if (audio) {
            // Find the text of the voiceline (it may be text nodes, or inside italics or quotes)
            const text = $(el).text().trim();
            voicelines.push({ audio, text });
        }
    });

    console.log(JSON.stringify(voicelines.slice(0, 5), null, 2));
}

scrapeHero();
