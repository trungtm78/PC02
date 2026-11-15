import { caseNoticeLink } from './case-notification-policy.service';

/** What survives of the link of a notice about a case once its reader is known to be allowed to read the case (C13). */
describe('caseNoticeLink', () => {
  it('keeps the assignment tab of the case form when the notice pointed exactly there, at this case', () => {
    expect(caseNoticeLink('c1', '/cases/c1/edit?tab=phan-cong-xu-ly')).toBe('/cases/c1/edit?tab=phan-cong-xu-ly');
  });

  it.each([
    ['another case', '/cases/c2/edit?tab=phan-cong-xu-ly'],
    ['another tab', '/cases/c1/edit?tab=thong-tin'],
    ['more after the tab', '/cases/c1/edit?tab=phan-cong-xu-ly&next=https://elsewhere.example'],
    ['a deeper path', '/cases/c1/disclosures/p1'],
    ['another screen', '/petitions/c1?tab=phan-cong-xu-ly'],
    ['no link', null],
  ])('%s: the case itself and nothing else', (_name, link) => {
    expect(caseNoticeLink('c1', link)).toBe('/cases/c1');
  });
});
