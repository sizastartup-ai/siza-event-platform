async function testApi() {
    const venueId = 11;
    console.log(`Fetching venue ${venueId} from API...`);
    
    try {
        const response = await fetch(`http://localhost:3000/api/venues/${venueId}`);
        const data = await response.json();
        
        console.log('API Response event_categories:', data.venue.event_categories);
        console.log('Type of event_categories:', typeof data.venue.event_categories);
    } catch (err) {
        console.error('API Error:', err.message);
    }
}

testApi();
