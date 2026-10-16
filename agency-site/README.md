# Easy Labs

Static public site for Easy Agent Agency. The site name is Easy Labs. The company name stays Easy Agent Agency.

Two offers:

- **Clearline** — enquiry capture, qualification, and follow-up until a job is booked.
- **Northgauge** — workflow automation and a dashboard the owner can read (enquiries, response time, bookings, confirmed revenue).

Australia-based. No build step and no payment processing. Publish this folder as it stands. It does not contain hosting credentials.

## Open the site

From this folder:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080](http://127.0.0.1:8080).

- Home: `index.html`
- Clearline: `clearline.html`
- Northgauge: `northgauge.html`
- ROI calculator: `index.html#calculator`
- Email opt-in: `index.html#updates`

## Configure

Edit `config.js` only. Leave a value empty until you want that feature on.

| Setting | Empty behaviour |
| --- | --- |
| `contactEmail` | The enquiry form does not open a mail draft. It tells the visitor the inbox is not configured. |
| `aweberListId` and `aweberFormAction` | The opt-in form does not submit anywhere and says the list is not connected yet. |
| `aweberRedirect` | Optional https thank-you URL. Ignored unless it is https. |

`aweberFormAction` is the form action from your existing paid AWeber HTML signup form. The usual value is `https://www.aweber.com/scripts/addlead.pl`. `aweberListId` is that form's `listname` value. When both are set, the page posts name and email with AWeber's standard hidden fields (`listname`, `redirect`, `meta_message`, `meta_required`, `meta_adtracking`). This site does not send email, store addresses, or provide a bulk-send tool.

The enquiry form uses a `mailto:` link in the visitor's own mail app. It does not post the message to a server.

## Prices

Indicative, in Australian dollars, exclusive of GST and third-party fees:

- Growth Audit — custom quote
- Enquiry and Booking Setup — A$2,950 one-time
- Managed Support — from A$299 per month

There is no checkout.

## Deploy

Host this folder on any static host. Serve it over HTTPS on a domain you control. Do not put secrets in `config.js`.
