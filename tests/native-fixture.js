// This page does not load any extension scripts or Chrome API mocks.
setTimeout(() => {
  const link = document.createElement('a');
  link.href = '/member/carol';
  link.textContent = 'Carol';
  document.getElementById('dynamic').append(link);
}, 500);
setTimeout(() => {
  const count = document.querySelectorAll('[data-user-tags-host]').length;
  document.getElementById('result').textContent =
    count === 3
      ? 'NATIVE ALL PASS: installed extension injected 3 username hosts including dynamic content'
      : 'NATIVE FAILED: expected 3 username hosts, found ' + count;
}, 2500);
