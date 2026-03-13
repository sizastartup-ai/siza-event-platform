
const supabase = require('./supabaseClient');

async function checkSizes() {
    console.log('Checking venue data sizes...');
    const { data: venues, error } = await supabase.from('venues').select('id, title');

    if (error) {
        console.error('Error fetching IDs:', error);
        return;
    }

    for (const v of venues) {
        console.log(`\nTesting Venue: ${v.title} (ID: ${v.id})`);
        const start = Date.now();
        try {
            // Use a promise with timeout to see if it even finishes
            const fetchPromise = supabase.from('venues').select('image, description, amenities').eq('id', v.id).single();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));

            const result = await Promise.race([fetchPromise, timeoutPromise]);
            const end = Date.now();

            if (result.data) {
                const imgLen = result.data.image ? result.data.image.length : 0;
                const descLen = result.data.description ? result.data.description.length : 0;
                const amenLen = result.data.amenities ? result.data.amenities.length : 0;
                console.log(`- Fetch took: ${end - start}ms`);
                console.log(`- Image size: ${(imgLen / 1024).toFixed(2)} KB`);
                console.log(`- Description size: ${(descLen / 1024).toFixed(2)} KB`);
                console.log(`- Amenities size: ${(amenLen / 1024).toFixed(2)} KB`);
            }
        } catch (e) {
            console.error(`- Error/Timeout fetching details for ${v.title}:`, e.message);
        }
    }
}

checkSizes().then(() => process.exit(0));
