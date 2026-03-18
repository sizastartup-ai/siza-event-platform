const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const SIZA_LOGO_URL = 'https://siza.co.ke/assets/logo.png'; // Update with actual URL if available
const SIZA_PRIMARY_COLOR = '#0ea5e9'; // Siza blue

/**
 * Notifies the venue owner of a new booking
 */
async function sendOwnerBookingNotification(ownerEmail, bookingDetails, venueTitle) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Siza <onboarding@resend.dev>',
            to: ownerEmail,
            subject: `New Booking: ${venueTitle}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                    <h1 style="color: ${SIZA_PRIMARY_COLOR};">New Booking Request!</h1>
                    <p>Good news! Your venue <strong>${venueTitle}</strong> has received a new booking request.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid ${SIZA_PRIMARY_COLOR};">
                        <h3 style="margin-top: 0;">Booking Details:</h3>
                        <p><strong>Customer:</strong> ${bookingDetails.renter_name}</p>
                        <p><strong>Email:</strong> ${bookingDetails.renter_email}</p>
                        <p><strong>Phone:</strong> ${bookingDetails.renter_phone}</p>
                        <p><strong>Event:</strong> ${bookingDetails.event_category}</p>
                        <p><strong>Date:</strong> ${new Date(bookingDetails.booking_date).toDateString()}</p>
                        <p><strong>Total Amount:</strong> KSh ${bookingDetails.total_price.toLocaleString()}</p>
                    </div>

                    <p style="margin-top: 20px;">Please reach out to the customer or log in to your dashboard to manage this booking.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2025 Siza Platform. All rights reserved.</p>
                </div>
            `
        });

        if (error) {
            console.error('[EMAIL SERVICE] Resend Error (Owner):', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[EMAIL SERVICE] Fatal Error (Owner):', err);
        return false;
    }
}

/**
 * Sends a confirmation email to the renter
 */
async function sendRenterConfirmation(renterEmail, renterName, venueTitle) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Siza <onboarding@resend.dev>',
            to: renterEmail,
            subject: `Booking Request Received: ${venueTitle}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                    <h1 style="color: ${SIZA_PRIMARY_COLOR};">We've Received Your Request!</h1>
                    <p>Hello ${renterName},</p>
                    <p>Thank you for choosing <strong>${venueTitle}</strong> via Siza! We have successfully received your booking request.</p>
                    
                    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid ${SIZA_PRIMARY_COLOR};">
                        <p style="margin: 0; font-size: 16px;"><strong>What's Next?</strong></p>
                        <p style="margin-top: 10px;">A Siza representative and the venue owner will reach out to you shortly via the contact information you provided to finalize the arrangements.</p>
                    </div>

                    <p style="margin-top: 20px;">If you have any urgent questions, please feel free to reply to this email.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #64748b; text-align: center;">Thank you for using Siza &mdash; The Ultimate Venue Marketplace.</p>
                </div>
            `
        });

        if (error) {
            console.error('[EMAIL SERVICE] Resend Error (Renter):', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[EMAIL SERVICE] Fatal Error (Renter):', err);
        return false;
    }
}

module.exports = {
    sendOwnerBookingNotification,
    sendRenterConfirmation
};
