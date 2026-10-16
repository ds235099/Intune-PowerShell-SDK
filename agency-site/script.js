'use strict';

var fields = ['leads', 'conversion', 'improvement', 'order', 'cost'];

function byId(id) {
  return document.getElementById(id);
}

function money(value) {
  var sign = value < 0 ? '-' : '';
  var amount = Math.abs(Math.round(value));
  return sign + 'A$' + amount.toLocaleString('en-AU');
}

function siteConfig() {
  return window.AGENCY_SITE || {};
}

function isHttpsUrl(value) {
  try {
    var url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    return url.hostname.indexOf('.') !== -1;
  } catch (error) {
    return false;
  }
}

function setupYear() {
  var year = byId('year');
  if (year) year.textContent = String(new Date().getFullYear());
}

function setupMenu() {
  var button = byId('menuButton');
  var nav = byId('site-nav');
  if (!button || !nav) return;

  function closeMenu() {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Menu';
  }

  button.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Close' : 'Menu';
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
}

function setupCalculator() {
  var leads = byId('leads');
  if (!leads) return;

  function updateCalculator() {
    var values = {};
    fields.forEach(function (name) {
      values[name] = Number(byId(name).value);
    });

    byId('leadsValue').textContent = values.leads.toLocaleString('en-AU');
    byId('conversionValue').textContent = values.conversion + '%';
    byId('improvementValue').textContent = values.improvement + '%';
    byId('orderValue').textContent = money(values.order);
    byId('costValue').textContent = money(values.cost);

    var currentRate = values.conversion / 100;
    var liftedRate = currentRate * (1 + values.improvement / 100);
    var capped = liftedRate > 1;
    var usedRate = capped ? 1 : liftedRate;
    var extra = values.leads * (usedRate - currentRate);
    var gross = extra * values.order;

    byId('impliedResult').textContent = Math.round(usedRate * 1000) / 10 + '%';
    byId('salesResult').textContent = money(gross);
    byId('salesCount').textContent = extra.toFixed(1);
    byId('netResult').textContent = money(gross - values.cost);
    byId('multipleResult').textContent = values.cost > 0 ? (gross / values.cost).toFixed(1) + '×' : 'N/A';
    byId('capNote').hidden = !capped;
  }

  fields.forEach(function (name) {
    byId(name).addEventListener('input', updateCalculator);
  });
  updateCalculator();
}

function setupEnquiry() {
  var form = byId('enquiryForm');
  if (!form) return;

  var interest = byId('interest');
  var offer = new URLSearchParams(window.location.search).get('offer');
  if (interest && offer) {
    var match = Array.prototype.some.call(interest.options, function (option) {
      return option.value === offer;
    });
    if (match) interest.value = offer;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var status = byId('formStatus');
    if (!form.reportValidity()) return;

    var address = String(siteConfig().contactEmail || '').trim();
    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      status.textContent = 'Contact inbox has not been configured. The site owner needs to set contactEmail in config.js.';
      return;
    }

    var data = new FormData(form);
    var interestField = byId('interest');
    var interestText = interestField && interestField.selectedIndex >= 0
      ? interestField.options[interestField.selectedIndex].text
      : data.get('interest');
    var body = [
      'Name: ' + data.get('name'),
      'Email: ' + data.get('email'),
      'Business: ' + (data.get('business') || ''),
      'Interest: ' + interestText,
      'Project: ' + data.get('message'),
      '',
      'I consent to Easy Agent Agency contacting me about this enquiry.'
    ].join('\n');

    window.location.href = 'mailto:' + encodeURIComponent(address) +
      '?subject=' + encodeURIComponent('Easy Labs enquiry') +
      '&body=' + encodeURIComponent(body);
    status.textContent = 'Your email application should open. Review the prepared enquiry and send it from there.';
  });
}

function setupOptIn() {
  var form = byId('optInForm');
  if (!form) return;

  var status = byId('optInStatus');
  var button = byId('optInButton');
  var config = siteConfig();
  var listId = String(config.aweberListId || '').trim();
  var action = String(config.aweberFormAction || '').trim();
  var redirect = String(config.aweberRedirect || '').trim();
  var listOk = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(listId);
  var connected = listOk && isHttpsUrl(action);

  function showDisconnected() {
    form.dataset.connected = 'false';
    form.classList.add('is-disconnected');
    form.removeAttribute('action');
    form.method = 'dialog';
    if (status) status.textContent = 'This list is not connected yet.';
  }

  if (!connected) {
    showDisconnected();
    form.noValidate = true;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showDisconnected();
    });
    if (button) {
      button.addEventListener('click', function () {
        showDisconnected();
      });
    }
    return;
  }

  form.dataset.connected = 'true';
  form.classList.remove('is-disconnected');
  form.method = 'post';
  form.action = action;
  form.acceptCharset = 'UTF-8';
  byId('aweberListName').value = listId;
  if (isHttpsUrl(redirect)) byId('aweberRedirect').value = redirect;
  if (button) button.type = 'submit';
  form.removeAttribute('onsubmit');
  if (status) {
    status.textContent = 'The list is connected. Submitting adds the name and email you enter to the agency AWeber list.';
    status.classList.add('is-ready');
  }
}

setupYear();
setupMenu();
setupCalculator();
setupEnquiry();
setupOptIn();
