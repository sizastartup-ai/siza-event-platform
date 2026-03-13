
const supabase = require('./supabaseClient');

async function debugLatency() {
    console.log('Testing Supabase Latency...');

    try {
        console.time('Ping (Auth)');
        await supabase.from('users').select('id').limit(1);
        console.timeEnd('Ping (Auth)');

        console.time('Venues Metadata');
        const { data: meta, error: mErr } = await supabase.from('venues').select('id, title').limit(5);
        console.timeEnd('Venues Metadata');
        if (mErr) console.error('Meta Error:', mErr);
        else console.log('Meta Count:', meta.length);

        console.time('Full Venues (Select *)');
        const { data: full, error: fErr } = await supabase.from('venues').select('*').limit(2);
        console.timeEnd('Full Venues (Select *)');

        if (fErr) {
            console.error('Full Error:', fErr);
        } else {
            console.log('Total characters in response:', JSON.stringify(full).length);
            full.forEach(v => {
                if (v.image) {
                    console.log(`Venue "${v.title}" image string length: ${v.image.length}`);
                }
            });
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

debugLatency().then(() => process.exit(0));
