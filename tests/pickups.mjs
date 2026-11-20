import assert from "node:assert/strict";
import {readFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {database, insert, transaction, queryOne} from "../server/database.js";
import {preparePickups, pickupAction} from "../server/pickups.js";

const dir = await mkdtemp(join(tmpdir(),"pickup-test-"));
process.env.TURSO_DATABASE_URL = "file:"+join(dir,"test.db");
delete process.env.TURSO_AUTH_TOKEN;
try {
  await database().executeMultiple(await readFile(new URL("../server/schema.sql",import.meta.url),"utf8"));
  const communityId = await insert("Community",{name:"test",address:"",guide:""});
  async function account(role,name) {
    const id = await insert("User",{username:name,name,passwordHash:"unused",communityId,role});
    if(role==="buyer") await insert("Buyer",{userId:id,shop:name,vehicle:"truck",capacity:50000,area:"test",approved:1});
    return {id,role,communityId};
  }
  const seller=await account("seller","s"),other=await account("seller","other");
  const buyer=await account("buyer","b"),next=await account("buyer","next");
  await preparePickups();
  const action=(user,action,body={})=>transaction(()=>pickupAction(user,{action,...body}));
  const position={lat:13.7,lng:100.5};
  await action(seller,"create",{...position,grams:3000,material:"paper"});
  const id=(await action(seller,"list")).own.id;
  assert.ok(!(await action(other,"list")).own);
  assert.equal((await action(buyer,"list",{position:{lat:0,lng:0}})).offers.length,0);
  assert.equal((await action(buyer,"list",{position})).offers[0].lat,undefined);
  await action(buyer,"accept",{id,position});
  await assert.rejects(action(next,"accept",{id,position}));
  await action(buyer,"cancel",{id});
  await action(next,"accept",{id,position});
  await action(next,"fix",{id,...position,time:Date.now()});
  assert.equal((await action(seller,"list")).own.driverLat,13.7);
  await assert.rejects(action(buyer,"fix",{id,...position,time:Date.now()}));
  await action(next,"arrive",{id});
  await assert.rejects(action(next,"fix",{id,...position,time:Date.now()}));
  await action(next,"weigh",{id,measured:3250,amount:5000});
  await assert.rejects(action(seller,"finish",{id,expectedAmount:5,expectedWeight:3250}));
  await action(seller,"finish",{id,expectedAmount:5000,expectedWeight:3250});
  assert.equal((await action(seller,"list")).last.status,"done");
  assert.equal((await queryOne("SELECT lat FROM Pickup WHERE id=?",id)).lat,null);
  console.log("Pickup lifecycle and access checks passed");
} finally {
  database().close();
  await rm(dir,{recursive:true,force:true});
}
