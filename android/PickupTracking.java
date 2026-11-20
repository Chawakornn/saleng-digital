package app.salengdigital.demo;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import org.json.*;

public final class PickupTracking extends Service implements LocationListener {
    static volatile int active;
    private int job;
    private String cookie;
    private LocationManager gps;
    private final ScheduledExecutorService network = Executors.newSingleThreadScheduledExecutor();
    private volatile Location latest;
    private long sent;
    private long lastVerified;
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(intent==null || "stop".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if(job!=0) return START_NOT_STICKY;
        job=intent.getIntExtra("job",0);
        cookie=intent.getStringExtra("cookie");
        if(job<=0 || cookie==null) {stopSelf();return START_NOT_STICKY;}
        NotificationManager notifications=getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel("pickup","แชร์ตำแหน่งรถ",NotificationManager.IMPORTANCE_LOW));
        PendingIntent stop=PendingIntent.getService(this,0,new Intent(this,PickupTracking.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE);
        Notification note=new Notification.Builder(this,"pickup").setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("กำลังแชร์ตำแหน่งรถกับผู้ขาย").setContentText("งานรับวัสดุ #"+job)
            .setOngoing(true).addAction(android.R.drawable.ic_menu_close_clear_cancel,"หยุดแชร์",stop).build();
        try {
            startForeground(44,note);
            gps=getSystemService(LocationManager.class);
            for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}) {
                if(gps.isProviderEnabled(provider)) {
                    try {gps.requestLocationUpdates(provider,5000,3,this);} catch(SecurityException ignored){}
                }
            }
            lastVerified=SystemClock.elapsedRealtime();
            active=job;
            network.scheduleWithFixedDelay(this::sync,0,7,TimeUnit.SECONDS);
        } catch(RuntimeException e){stopSelf();}
        return START_NOT_STICKY;
    }
    public void onLocationChanged(Location l){latest=l;}
    public void onProviderEnabled(String p){}
    public void onProviderDisabled(String p){}
    public void onStatusChanged(String p,int status,Bundle extras){}
    private void sync(){
        HttpURLConnection conn=null;
        try {
            if(SystemClock.elapsedRealtime()-lastVerified>300000){stopSelf();return;}
            Location l=latest;
            boolean fix=l!=null && l.getTime()>sent && System.currentTimeMillis()-l.getTime()<90000;
            JSONObject body=new JSONObject().put("action",fix?"fix":"list").put("id",job);
            if(fix) body.put("lat",l.getLatitude()).put("lng",l.getLongitude()).put("time",l.getTime());
            conn=(HttpURLConnection)new URL(MainActivity.START+"api/pickup").openConnection();
            conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(8000);conn.setReadTimeout(8000);
            conn.setRequestMethod("POST");conn.setDoOutput(true);
            conn.setRequestProperty("Cookie",cookie);conn.setRequestProperty("Content-Type","application/json");
            try(OutputStream out=conn.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}
            int code=conn.getResponseCode();
            if(code==401 || code==403 || code==409){stopSelf();return;}
            if(code!=200)return;
            lastVerified=SystemClock.elapsedRealtime();
            if(fix){sent=l.getTime();return;}
            try(java.util.Scanner reader=new java.util.Scanner(conn.getInputStream(),"UTF-8").useDelimiter("\\A")){
                JSONObject own=new JSONObject(reader.next()).optJSONObject("own");
                if(own==null || own.optInt("id")!=job || !("matched".equals(own.optString("status")) || "driving".equals(own.optString("status"))))stopSelf();
            }
        } catch(Exception ignored){} finally {if(conn!=null)conn.disconnect();}
    }
    @Override public void onDestroy(){
        active=0;network.shutdownNow();if(gps!=null)gps.removeUpdates(this);stopForeground(true);super.onDestroy();
    }
}
