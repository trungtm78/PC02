const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const inventory=require('../../requirements/case-governance/entrypoint-inventory.json');
const direct=new Set(['subjects','lawyers','conclusions','investigation-supplements']);
const accountWrites=new Set(['createUser','updateUser','deleteUser','resetUserTwoFa','moKhoaTaiKhoan','updateRole','deleteRole','updateRolePermissions','createDataAccessGrant','revokeDataAccessGrant','confirm','getJob','downloadEnriched','downloadHandoverZip']);
const directory=new Set(['getUsers','getUserById','getRoles','getRoleById','getRolePermissions','getAllPermissions','preview','downloadTemplate','listDataAccessGrants']);
const rows=inventory.rows.map(row=>{
  let owner='child-access',effect='CASE_GRAPH_OR_QUERY',status='OPEN_SOURCE_REVIEW',evidence='Candidate service references require route-specific closure';
  if(row.module==='cases'||row.module==='audit'){owner='root/core-or-T1b';effect='CASE_DIRECT';status='OTHER_OWNER';evidence='Frozen foundation/T1b report and root independent review';}
  if(['documents','legacy-migration','xlsx-imports'].includes(row.module)){owner='T3';effect='CASE_DOCUMENT_IMPORT_OR_ASSET';status='OTHER_OWNER';evidence='T3 source and evidence report';}
  if(direct.has(row.module)){
    effect='CASE_CHILD';
    status='IMPLEMENTED_PENDING_REVIEW_UAT';
    evidence='CaseChildAccessService: current entity + view predicate; pinned parent token/hydration; serializable child/audit/parent CAS';
  }
  if(row.module==='admin'){
    effect=accountWrites.has(row.handler)?'GOVERNANCE_AUTHORITY_OR_CREDENTIALS':directory.has(row.handler)?'NON_CASE_DIRECTORY':'GENERAL_SCOPE_DELEGATION';
    status=accountWrites.has(row.handler)?'IMPLEMENTED_PENDING_REVIEW_UAT':directory.has(row.handler)?'NON_CASE_ACTUAL_EFFECT':'OPEN_CURRENT_AUTHORITY_REVIEW';
    evidence=accountWrites.has(row.handler)?'case-authority.guard / EnrollmentService / createUserCore / getJob; current business target roles/grants/scope and token invalidation':directory.has(row.handler)?'Returns account/catalog/template data; no Case dossier rows or Case graph':'Ordinary DataAccessGrant domain; Case-specific sensitivity/profile remains foundation-owned';
  }
  if(row.module==='document-templates'){effect='NON_CASE_TEMPLATE_CATALOG';status='NON_CASE_ACTUAL_EFFECT';evidence='Controller manages template metadata/files/catalog, not rendered Case records; DynamicExport render consumers separately OPEN';}
  if(row.module==='incidents'||row.module==='petitions'){
    effect=['prosecute','convertToCase'].includes(row.handler)?'EXPLICIT_CASE_SOURCE_CREATE':['getById','getJourney','delete','previewDelete','bulkDelete','bulkExport','exportWord','exportDocuments','exportDocumentBatch','dynamicExportDocuments','xuatDayDu','xuatDanhSach','exportExcel'].includes(row.handler)?'CASE_GRAPH_OR_SOURCE_EFFECT':'NON_CASE_DOMAIN_WITH_GRAPH_SERIALIZATION_REVIEW';
    const dynamic=['exportDocuments','exportReadiness','dynamicExportDocuments','dynamicExportReadiness','exportDocumentBatch'];
    if(dynamic.includes(row.handler)){owner='case_core_integration_finish (graph transfer)';status='OTHER_OWNER';effect='CASE_RENDERED_TEMPLATE_EFFECT';evidence='Graph worker owns DynamicExport Case-derived rendering/native export/profile guards; source controller retains its source scope precheck';}
    else if(['prosecute','convertToCase'].includes(row.handler)){status='IMPLEMENTED_PENDING_REVIEW_UAT';evidence='CaseSourceCreationService current creation/source authority, canonical/pinned schema, source CAS/ledger, counter/link/audit/outbox; T3 source document guard. Private PostgreSQL real Incident converter/counter/replay PASS';}
    else if(['delete','bulkDelete','mergeInto'].includes(row.handler)){status='IMPLEMENTED_PENDING_REVIEW_UAT';effect='CASE_SOURCE_PRESERVATION';evidence='Current source/parent writable permissions/scope, governed lineage and Case-owned document preservation, serializable handler/audit/parent CAS; original unrelated source protocol retained';}
    else if(['exportWord','xuatDayDu','xuatDanhSach','exportExcel','exportDuplicates','exportWardPetitions','exportWard','bulkExport'].includes(row.handler)){status='NON_CASE_ACTUAL_EFFECT';effect='SOURCE_ONLY_STREAM_EXPORT';evidence='Actual selected XLSX/Word columns/form registries/bulk sheets contain source fields, not Case IDs/Case-derived native fields. Current original source permission/scope protocol retained; rendered dynamic Case effects assigned graph owner';}
    else {status='IMPLEMENTED_PENDING_REVIEW_UAT';effect='SOURCE_DOMAIN_WITH_CONDITIONAL_CASE_GRAPH';evidence='Ordinary source protocol preserved. Every JSON response passes authenticated CaseGraphPolicyInterceptor: exact current foreign Case view and own pinned native policy remove inaccessible IDs/graphs/labels; source list/count predicates are not replaced with generic Case SQL';}
  }
  if(['proposals','delegations'].includes(row.module)){status='IMPLEMENTED_PENDING_REVIEW_UAT';effect='OPTIONAL_CASE_CHILD';evidence='Standalone creator protocol; linked Case current view before list/count/search; own pinned hydration/export. Source/target current writable Case, exact child parent/version, number/audit/parent CAS atomic; Delegation notifications after commit';}
  if(['calendar','kpi','reports','monthly-reports','shared','notifications'].includes(row.module)){owner='case_core_integration_finish (graph transfer)';status='OTHER_OWNER';evidence='67 graph rows explicitly transferred; consult graph worker report for actual closure and coverage';}
  if(row.file.includes('/cases/bulk/')&&row.handler==='bulkAssign'){owner='child-access (bounded transfer)';status='IMPLEMENTED_PENDING_REVIEW_UAT';evidence='Current INTERNAL dispatch scope and governed operate capability; same transaction event/audit/revision and stable replay. OFF ordinary legacy compatibility preserved';}
  if(row.file.includes('case-operations.controller')){owner='child-access (transferred)';status='IMPLEMENTED_QUEUE_CIVIL_NATIVE_DELTA_PENDING_REVIEW';evidence='Same current view rows, pinned serialization, explicit native readiness and HCM civil days; tasks native payload review remains OPEN';}
  return {...row,owner,actualEffect:effect,closureStatus:status,evidence,currentRole:status.startsWith('IMPLEMENTED')?'Current DB actor/entity permissions; no JWT ADMIN cap grant':'OWNER_OR_OPEN',currentScope:status.startsWith('IMPLEMENTED')?'Foundation current scope; business account targets in active writable teams':'OWNER_OR_OPEN',sensitivityAndProfile:status.startsWith('IMPLEMENTED')?'Current sensitivity/grants; exact REP view/edit or INTERNAL creation/account management':'OWNER_OR_OPEN',nativePolicy:direct.has(row.module)?'Pinned hydrated parent fields and parent-token partitions':'OWNER_OR_OPEN'};
});
const result={timestamp:new Date().toISOString(),candidateCount:inventory.routeCount,triagedRowCount:rows.length,status:'Every candidate assigned an actual-effect category/owner; OPEN and other-owner rows are not claimed closed',supplementalEntrypoints:['Auth enrollment issue/consume and source adapter internals; physical Evidence ordinary established-state PUT/bulk: NOT APPLICABLE (no route/delegate found)'],rows};
fs.writeFileSync(path.join(__dirname,'child-entrypoint-matrix.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({candidateCount:inventory.routeCount,triaged:rows.length,implementedPending:rows.filter(r=>r.closureStatus.startsWith('IMPLEMENTED')).length,open:rows.filter(r=>r.closureStatus.startsWith('OPEN')).length,otherOwner:rows.filter(r=>r.closureStatus==='OTHER_OWNER').length,nonCase:rows.filter(r=>r.closureStatus==='NON_CASE_ACTUAL_EFFECT').length}));
