import {execute, insert, queryOne, queryAll, requireCondition, requireRole, transaction} from "./database.js";

let ready;
export function preparePickups() {
  ready ??= transaction(async () => {
    await execute(`CREATE TABLE IF NOT EXISTS Pickup (
      id INTEGER PRIMARY KEY, communityId INTEGER NOT NULL, sellerId INTEGER NOT NULL REFERENCES User(id),
      buyerId INTEGER REFERENCES User(id), material TEXT NOT NULL, grams INTEGER NOT NULL,
      lat REAL, lng REAL, status TEXT NOT NULL DEFAULT 'open', driverLat REAL, driverLng REAL,
      seen INTEGER, measured INTEGER, amount INTEGER, created INTEGER NOT NULL)`);
    for (const owner of ['sellerId','buyerId']) {
      await execute(`CREATE UNIQUE INDEX IF NOT EXISTS pickup_active_${owner} ON Pickup(${owner})
        WHERE status NOT IN ('done','cancelled')`);
    }
  }).catch(error => { ready = undefined; throw error; });
  return ready;
}
function validPoint({lat,lng}) {
  requireCondition(Number.isFinite(lat) && Math.abs(lat)<=90 && Number.isFinite(lng) && Math.abs(lng)<=180,"พิกัดไม่ถูกต้อง",400);
}
function distance(a,b) {
  const rad=Math.PI/180;
  const h=Math.sin((a.lat-b.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((a.lng-b.lng)*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,h)));
}
function integer(value,max) { return Number.isSafeInteger(value) && value>0 && value<=max; }
export async function pickupAction(user,p) {
  requireRole(user,'seller','buyer');
  const buyer=user.role==='buyer';
  const profile=buyer && await queryOne("SELECT shop,capacity FROM Buyer WHERE userId=? AND approved=1",user.id);
  if(buyer) requireCondition(profile,"เฉพาะร้านที่ได้รับอนุมัติ",403);
  const owner=buyer?'buyerId':'sellerId';
  const own=await queryOne(`SELECT p.*,b.shop FROM Pickup p LEFT JOIN Buyer b ON b.userId=p.buyerId
    WHERE p.${owner}=? AND p.status NOT IN ('done','cancelled')`,user.id);
  if(p.action==='list') {
    let offers=[];
    if(buyer && !own && p.position) {
      validPoint(p.position);
      const rows=await queryAll("SELECT id,material,grams,lat,lng FROM Pickup WHERE status='open' AND communityId=? AND grams<=?",user.communityId,profile.capacity);
      offers=rows.map(({lat,lng,...info})=>({...info,km:distance(p.position,{lat,lng})})).filter(x=>x.km<=20).sort((a,b)=>a.km-b.km).slice(0,30).map(o=>({...o,km:Math.round(o.km*10)/10}));
    }
    const last=await queryOne(`SELECT id,status,material,measured,amount FROM Pickup WHERE ${owner}=? AND status IN ('done','cancelled') ORDER BY id DESC LIMIT 1`,user.id);
    return {own,offers,last};
  }
  if(p.action==='create') {
    requireRole(user,'seller'); requireCondition(!own,"มีคำขอที่กำลังดำเนินการ");validPoint(p);
    requireCondition(typeof p.material==='string' && p.material.trim().length>0 && p.material.length<=100 && integer(p.grams,100000000),"ตรวจชนิดวัสดุและน้ำหนัก",400);
    await insert('Pickup',{sellerId:user.id,communityId:user.communityId,material:p.material.trim(),grams:p.grams,lat:p.lat,lng:p.lng,created:Date.now()});
    return {ok:true};
  }
  if(p.action==='accept') {
    requireRole(user,'buyer');validPoint(p.position||{});
    const job=await queryOne("SELECT * FROM Pickup WHERE id=? AND status='open' AND communityId=?",p.id,user.communityId);
    requireCondition(!own && job && job.grams<=profile.capacity && distance(p.position,job)<=20,"งานไม่ว่างหรืออยู่นอกพื้นที่");
    await execute("UPDATE Pickup SET buyerId=?,status='matched' WHERE id=? AND status='open'",user.id,p.id);
    return {ok:true};
  }
  requireCondition(own && own.id===p.id,"งานนี้ไม่เปิดให้บัญชีนี้แล้ว",403);
  if(p.action==='fix') {
    requireRole(user,'buyer');validPoint(p);
    requireCondition(['matched','driving'].includes(own.status),"สิ้นสุดการแชร์ตำแหน่ง",409);
    requireCondition(Number.isSafeInteger(p.time) && Math.abs(Date.now()-p.time)<=120000,"พิกัดหมดอายุ",422);
    await execute("UPDATE Pickup SET status='driving',driverLat=?,driverLng=?,seen=? WHERE id=? AND (seen IS NULL OR seen<?)",p.lat,p.lng,p.time,p.id,p.time);
  } else if(p.action==='cancel' && ['open','matched','driving'].includes(own.status)) {
    if(buyer) await execute("UPDATE Pickup SET status='open', buyerId=NULL, driverLat=NULL,driverLng=NULL,seen=NULL WHERE id=?",p.id);
    else await execute("UPDATE Pickup SET status='cancelled',lat=NULL,lng=NULL,driverLat=NULL,driverLng=NULL,seen=NULL WHERE id=?",p.id);
  } else if(buyer && p.action==='arrive' && ['matched','driving'].includes(own.status)) {
    await execute("UPDATE Pickup SET status='arrived',driverLat=NULL,driverLng=NULL,seen=NULL WHERE id=?",p.id);
  } else if(buyer && p.action==='weigh' && ['arrived','weighed'].includes(own.status)) {
    requireCondition(integer(p.measured,100000000) && Number.isSafeInteger(p.amount) && p.amount>=0 && p.amount<=100000000,"ตรวจน้ำหนักและยอดเงิน",400);
    await execute("UPDATE Pickup SET status='weighed',measured=?,amount=? WHERE id=?",p.measured,p.amount,p.id);
  } else if(!buyer && p.action==='finish' && own.status==='weighed') {
    requireCondition(p.expectedAmount===own.amount && p.expectedWeight===own.measured,"ร้านแก้ไขยอด กรุณาตรวจสอบอีกครั้ง");
    await execute("UPDATE Pickup SET status='done',lat=NULL,lng=NULL WHERE id=?",p.id);
  } else requireCondition(false,"สถานะงานเปลี่ยนไปแล้ว");
  return {ok:true};
}
