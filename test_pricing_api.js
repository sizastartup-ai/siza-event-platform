const http = require('http');

function post(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ data: JSON.parse(body), status: res.statusCode }));
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ data: JSON.parse(body), status: res.statusCode }));
        }).on('error', reject);
    });
}

async function testPricing() {
    const baseUrl = 'http://localhost:3000';
    const testVenue = {
        owner_id: 1,
        title: 'Pricing Debug Test Vanilla ' + Date.now(),
        location: 'Test Location',
        location_tags: ['test', 'debug'],
        type: 'Indoor Spaces',
        guests: 100,
        price: 0,
        category_pricing: {
            "Weddings": { "price": 50000, "unit": "day" },
            "Brunch": { "price": 2000, "unit": "person" }
        },
        image: [],
        amenities: ["WiFi"],
        event_categories: ["Weddings", "Brunch"],
        description: "Test venue with pricing"
    };

    try {
        console.log("--- Step 1: Creating Test Venue ---");
        const createResp = await post(`${baseUrl}/api/venues`, testVenue);
        console.log("Create Status:", createResp.status);
        console.log("Create Response:", createResp.data);

        const id = createResp.data.venueId || createResp.data.bookingId || createResp.data.id;
        if (!id) throw new Error("ID not found in response : " + JSON.stringify(createResp.data));

        console.log("\n--- Step 2: Fetching Venue ---");
        const getResp = await get(`${baseUrl}/api/venues/${id}`);
        const venue = getResp.data.venue;
        console.log("Fetched category_pricing type:", typeof venue.category_pricing);
        console.log("Fetched category_pricing content:", JSON.stringify(venue.category_pricing, null, 2));

    } catch (err) {
        console.error("Test Error:", err.message);
    }
}

testPricing();
