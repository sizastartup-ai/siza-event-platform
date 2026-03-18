const supabase = require('./supabaseClient');

async function testPricingUpdate() {
    console.log('Fetching first venue to test...');
    const { data: venues, error: fetchError } = await supabase.from('venues').select('id, title').limit(1);
    
    if (fetchError || !venues || venues.length === 0) {
        console.error('Fetch error:', fetchError);
        return;
    }

    const testVenueId = venues[0].id;
    const testPricing = {
        "Weddings": { "price": 100, "unit": "day" },
        "Picnics": { "price": 50, "unit": "person" }
    };

    console.log(`Updating venue ID ${testVenueId} (${venues[0].title}) with pricing:`, testPricing);

    const { data: updateData, error: updateError } = await supabase
        .from('venues')
        .update({ category_pricing: testPricing })
        .eq('id', testVenueId)
        .select();

    if (updateError) {
        console.error('Update Error:', JSON.stringify(updateError, null, 2));
    } else {
        console.log('Update Success! Result:', JSON.stringify(updateData[0].category_pricing, null, 2));
    }
}

testPricingUpdate();
