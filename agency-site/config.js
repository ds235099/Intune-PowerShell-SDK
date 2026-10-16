/* Easy Labs — public site settings for Easy Agent Agency.
   This file is loaded in the visitor's browser. Do not put passwords,
   API keys, or any other secret in it.

   Leave each value as an empty string until you are ready to turn that
   feature on. Empty values are the safe published default. */

window.AGENCY_SITE = {
  /* Public inbox for the enquiry form.
     When this is a valid email address, "Prepare enquiry email" opens
     the visitor's own mail app with a draft. This site never sends mail.
     Keep this blank until the address is one you are happy to publish. */
  contactEmail: '',

  /* AWeber HTML signup form.
     Paste these from the existing paid AWeber account. Nothing here opens
     a new AWeber account, and this site does not send email itself.
     Typical form action: https://www.aweber.com/scripts/addlead.pl
     Typical list id: the listname value from that form, such as awlist1234567.
     While either the list id or the form action is empty, the opt-in form
     does not submit anywhere. */
  aweberListId: '',
  aweberFormAction: '',

  /* Optional https thank-you page AWeber should send the visitor to
     after a successful signup. Leave blank to omit it. */
  aweberRedirect: ''
};
