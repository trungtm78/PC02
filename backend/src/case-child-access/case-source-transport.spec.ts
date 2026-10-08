import { BadRequestException,ValidationPipe } from '@nestjs/common';
import { ProsecuteIncidentDto } from '../incidents/dto/prosecute-incident.dto';
import { ConvertToCaseDto } from '../petitions/dto/convert-case.dto';
describe.each([ProsecuteIncidentDto,ConvertToCaseDto])('CG14 bounded %p source custom transport',Dto=>{
  const valid={caseName:'Synthetic authorized Case',...(Dto===ProsecuteIncidentDto?{prosecutionDecision:'QD-1',prosecutionDate:'2026-10-01'}:{crime:'Synthetic crime',jurisdiction:'Synthetic jurisdiction'}),expectedUpdatedAt:'2026-10-06T00:00:00.000Z',requestKey:'source-operation'};
  const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
  it('accepts a typed custom object including false/zero without allowing arbitrary Case metadata',async()=>{
    const result=await pipe.transform({...valid,caseCustomFields:{custom_checked:false,custom_amount:0}},{type:'body',metatype:Dto});
    expect(result.caseCustomFields).toEqual({custom_checked:false,custom_amount:0});
    await expect(pipe.transform({...valid,metadata:{_sensitivity:'NORMAL'}},{type:'body',metatype:Dto})).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([[],false,0,'arbitrary'])('rejects non-object custom values %p',async value=>{
    await expect(pipe.transform({...valid,caseCustomFields:value},{type:'body',metatype:Dto})).rejects.toBeInstanceOf(BadRequestException);
  });
});
