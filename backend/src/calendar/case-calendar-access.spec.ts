/* Focused authorization boundary fixture; domain calendar tests remain separate. */
import { CalendarService } from './calendar.service';
import { CaseGraphAccessService } from '../reports/graph-access/case-graph-access.service';
describe('Calendar Case query authorization', () => {
  it('attaches current Case authorization before selecting private deadline facts', async () => {
    const cases = jest.fn().mockResolvedValue([]);
    const db = {
      user:{findUnique:jest.fn().mockResolvedValue({id:'reader',isActive:true,role:{name:'ADMIN',permissions:[{permission:{subject:'Case',action:'read',conditions:null}}]}})},
      $queryRaw:jest.fn().mockResolvedValue([]),caseFieldDefinitionVersion:{findMany:jest.fn().mockResolvedValue([])},
      case: { findMany: cases }, incident: { findMany: jest.fn().mockResolvedValue([]) }, petition: { findMany: jest.fn().mockResolvedValue([]) }, calendarEvent: { findMany: jest.fn().mockResolvedValue([]) } };
    const access=new CaseGraphAccessService(db as never);
    const service = new CalendarService(access.wrap(), { expandOccurrences: () => [] } as never);
    await access.run('reader',()=>service.getEvents(2026, 10));
    expect(JSON.stringify(cases.mock.calls[0])).toContain('sensitivity');
    expect(JSON.stringify(db.incident.findMany.mock.calls[0])).not.toContain('sensitivity');
  });
});
