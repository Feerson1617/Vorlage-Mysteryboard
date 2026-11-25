import content from "../../schemas/mystery-content.schema.json" with { type: "json" };
import document from "../../schemas/mystery-document.schema.json" with { type: "json" };
const object = (properties:Record<string,unknown>,required:string[])=>({type:"object",additionalProperties:false,properties,required});
const ref=(key:string)=>({$ref:"#/definitions/"+key});
const {id,version,initial,startEdgesAsHints,...fields}=content.properties;
const regularAuthor=document.oneOf[1].properties.author!.properties;
const {status,edges,...author}=regularAuthor;
const level={content:ref("content"),author:ref("author"),studentHints:ref("edges"),startPositions:ref("positions")};
export const exchangeSchema={
  $schema:"http://json-schema.org/draft-07/schema#",
  ...object({format:{const:"MysteryBoardAI"},formatVersion:{const:1},kind:{const:"project"}, project:{type:"object",properties:{kind:{enum:["single","collection"]}},required:["kind"],if:{properties:{kind:{const:"single"}}},then:ref("single"),else:ref("collection")}},["format","formatVersion","kind","project"]),
  definitions:{
    edge:content.definitions.edge,edges:initial.properties.edges,positions:initial.properties.cards,
    content:object({...fields,cards:{...fields.cards,items:{...fields.cards.items,required:fields.cards.items.required.filter(k=>k!=="group")}}},["title","cards"]),
    author:object({...author,edges:ref("edges")},[]),
    single:object({kind:{const:"single"},...level},["kind","content"]),
    level:object({name:{type:"string",minLength:1,maxLength:60},description:{type:"string",maxLength:300},...level},["name","content"]),
    collection:object({kind:{const:"collection"},title:fields.title,defaultRecovery:fields.recovery,levels:{type:"array",minItems:1,maxItems:12,items:ref("level")}},["kind","title","levels"])
  }
};
