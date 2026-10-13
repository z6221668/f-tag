(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    await wait(500);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 500,
      'initial long-page hosts missing',
    );
    const state = testState();
    state.users[0].levelId = 'level-2';
    await testSetState(state);
    await wait(250);
    const first = testShadow(document.getElementById('user-0').nextElementSibling);
    assert(
      first.querySelector('.tag').textContent === state.levels[1].name,
      'indexed update did not refresh grade',
    );
    document
      .getElementById('authors')
      .append(...Array.from({ length: 100 }, (_, index) => stressLink(index + 500)));
    await wait(400);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 600,
      'dynamic long-page hosts missing',
    );
    await wait(300);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 600,
      'observer duplicated hosts',
    );
    assert(testState().users.length === 10000, 'stored record count changed during scanning');
    document.getElementById('result').textContent =
      'ALL PASS: 10000 saved records, 600 author links and indexed update';
  } catch (error) {
    document.getElementById('result').textContent = 'FAILED ' + error.message;
  }
})();
