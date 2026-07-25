import nodemailer from 'nodemailer'

// Step 1 — create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',  // which service?
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
})

// Step 2 — create sendAlertEmail function
export const sendAlertEmail = async (
  to: string,        // user's email
  cityName: string,  // which city
  condition: string, // what condition was met
  value: number      // actual current value
) => {
    try {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: `Weather Alert for ${cityName}`,
    html: `
      <h2>Weather Alert! 🌤️</h2>
      <p>Your alert condition for <b>${cityName}</b> has been met!</p>
      <p>Condition: ${condition}</p>
      <p>Current value: ${value}</p>
    `
  })
 console.log(`Alert email sent to ${to}`)
} catch (error) {
    console.error('Failed to send email:', error)
  }
}