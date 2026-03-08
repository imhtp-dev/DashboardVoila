/**
 * SendGrid Email Utilities
 */

/**
 * Send registration email for new users
 */
export async function sendRegistrationEmail(toEmail, userName, password) {
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
  <title>Accesso Dashboard Voilà Voice Agent</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: #667eea; padding: 25px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Voilà Voice Agent Dashboard</h1>
    </div>

    <!-- Body -->
    <div style="padding: 35px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px; color: #333;">
        Gentile <strong>${userName}</strong>,
      </p>

      <p style="font-size: 15px; margin-bottom: 25px; color: #555; line-height: 1.8;">
        Il tuo account amministratore per la dashboard del voice agent Voilà è stato configurato.
        Di seguito troverai le tue credenziali di accesso personali.
      </p>

      <!-- Credentials Box -->
      <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px;">Credenziali di Accesso</h3>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; width: 100px;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Password:</strong></td>
            <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${password}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.7;">
        Per motivi di sicurezza, ti consigliamo di modificare la password al primo accesso.
        Puoi accedere alla dashboard utilizzando il link seguente:
      </p>

      <!-- Login Link -->
      <div style="margin: 30px 0; text-align: center;">
        <a href="https://voilaagentdash.com/login"
           style="display: inline-block; background: #667eea; color: white; padding: 12px 35px; text-decoration: none; border-radius: 4px; font-size: 15px; font-weight: 500;">
          Accedi alla Dashboard
        </a>
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 25px; line-height: 1.7;">
        In caso di problemi di accesso o domande sul sistema,
        non esitare a contattare il supporto tecnico.
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 14px; color: #666; margin: 0;">
          Cordiali saluti,
        </p>
        <p style="font-size: 14px; color: #333; margin: 5px 0 0 0; font-weight: 500;">
          Team Voilà
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #888; margin: 5px 0;">
        Questo messaggio è stato generato automaticamente, si prega di non rispondere.
      </p>
      <p style="font-size: 12px; color: #888; margin: 5px 0;">
        &copy; 2025 Voilà Voice Agent Dashboard. Tutti i diritti riservati.
      </p>
    </div>
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
        ],
        tracking_settings: {
          click_tracking: {
            enable: false
          },
          open_tracking: {
            enable: false
          }
        }
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

/**
 * Send password reset email for existing users
 */
export async function sendPasswordResetEmail(toEmail, userName, password) {
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
  <title>Reimpostazione Password - Voilà Voice Agent Dashboard</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: #667eea; padding: 25px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Voilà Voice Agent Dashboard</h1>
    </div>

    <!-- Body -->
    <div style="padding: 35px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px; color: #333;">
        Gentile <strong>${userName}</strong>,
      </p>

      <p style="font-size: 15px; margin-bottom: 25px; color: #555; line-height: 1.8;">
        La password del tuo account è stata reimpostata con successo.
        Di seguito troverai le tue nuove credenziali di accesso.
      </p>

      <!-- Credentials Box -->
      <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px;">Nuove Credenziali</h3>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; width: 100px;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Password:</strong></td>
            <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${password}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.7;">
        Puoi accedere alla dashboard utilizzando le credenziali sopra indicate.
        Ti consigliamo di modificare la password al prossimo accesso.
      </p>

      <!-- Login Link -->
      <div style="margin: 30px 0; text-align: center;">
        <a href="https://voilaagentdash.com/login"
           style="display: inline-block; background: #667eea; color: white; padding: 12px 35px; text-decoration: none; border-radius: 4px; font-size: 15px; font-weight: 500;">
          Accedi alla Dashboard
        </a>
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 25px; line-height: 1.7;">
        Se non hai richiesto questa reimpostazione o hai bisogno di assistenza,
        contatta il supporto tecnico immediatamente.
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 14px; color: #666; margin: 0;">
          Cordiali saluti,
        </p>
        <p style="font-size: 14px; color: #333; margin: 5px 0 0 0; font-weight: 500;">
          Team Voilà
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #888; margin: 5px 0;">
        Questo messaggio è stato generato automaticamente, si prega di non rispondere.
      </p>
      <p style="font-size: 12px; color: #888; margin: 5px 0;">
        &copy; 2025 Voilà Voice Agent Dashboard. Tutti i diritti riservati.
      </p>
    </div>
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
            subject: 'Voilà Voice Agent Dashboard - Password Reimpostata'
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
        ],
        tracking_settings: {
          click_tracking: {
            enable: false
          },
          open_tracking: {
            enable: false
          }
        }
      })
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ SendGrid error:', error);
      return false;
    }
    console.log(`✅ Password reset email sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
}
