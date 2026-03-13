const supabase = require('./supabaseClient');

async function testQuery() {
    console.log('Testing simple select...');
    const { data, error } = await supabase.from('venues').select('*');
    if (error) {
        console.error('Simple Select Error:', error.message);
    } else {
        console.log('Simple Select Success:', data.length, 'venues found');
    }

    console.log('Testing count query...');
    const { data: data2, error: error2 } = await supabase.from('venues').select('*, venue_views(count)');
    if (error2) {
        console.error('Count Query Error:', error2.message);
    } else {
        console.log('Count Query Success!');
    }
}

testQuery().catch(err => console.error('Unhandled:', err));
