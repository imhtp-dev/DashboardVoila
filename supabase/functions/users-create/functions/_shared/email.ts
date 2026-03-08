/**
 * SendGrid Email Utilities
 */ export async function sendRegistrationEmail(toEmail, userName, password) {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL');
  if (!sendgridApiKey || !fromEmail) {
    console.error('❌ SendGrid credentials not configured');
    throw new Error('Email service not configured');
  }
  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Benvenuto a Voilà Voice Agent Dashboard</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Benvenuto! 👋</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Ciao <strong>${userName}</strong>,
    </p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Il tuo account per la <strong>Voilà Voice Agent Dashboard</strong> è stato creato con successo! 🎉
    </p>

    <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin-top: 0; color: #667eea;">📧 Credenziali di Accesso</h3>

      <div style="margin: 15px 0;">
        <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Email:</strong></p>
        <p style="margin: 5px 0; font-size: 16px; background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace;">${toEmail}</p>
      </div>

      <div style="margin: 15px 0;">
        <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Password:</strong></p>
        <p style="margin: 5px 0; font-size: 16px; background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace;">${password}</p>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://voilaagentdash.com/login"
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
        Accedi alla Dashboard
      </a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Se hai domande o hai bisogno di assistenza, non esitare a contattarci.
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Cordiali saluti,<br>
      <strong>Il Team Voilà</strong>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
    <p>Questa è una email automatica, si prega di non rispondere.</p>
    <p>&copy; 2025 Voilà Voice Agent Dashboard. Tutti i diritti riservati.</p>
  </div>
</body>
</html>
  `.trim();
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: toEmail
              }
            ],
            subject: 'Voilà Voice Agent Dashboard - Credenziali di Accesso'
          }
        ],
        from: {
          email: fromEmail
        },
        content: [
          {
            type: 'text/html',
            value: emailTemplate
          }
        ]
      })
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ SendGrid error:', error);
      return false;
    }
    console.log(`✅ Email sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}
