package app.salengdigital.demo;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.io.File;
import java.util.Arrays;

public final class UpdateActivity extends Activity {
    static final String VERSION = "version";
    private static final String STORE = "android-update", DOWNLOAD = "downloadId";
    private static final int SETTINGS = 1, INSTALL = 2;
    private final Handler handler = new Handler();
    private final Runnable check = this::checkDownload;
    private DownloadManager downloads;
    private SharedPreferences store;
    private int version, awaiting;
    private long downloadId;
    private boolean pausedForRetry;
    private TextView status;
    private ProgressBar progress;
    private Button retry;

    static String finishInstalledUpdate(Context context) {
        SharedPreferences state = context.getSharedPreferences(STORE, MODE_PRIVATE);
        if (!state.contains(DOWNLOAD)) return null;
        try {
            PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            int requested = state.getInt(VERSION, 0);
            if (requested <= installed.versionCode) clearDownload(context);
            if (requested == installed.versionCode) return installed.versionName;
        } catch (PackageManager.NameNotFoundException ignored) { }
        return null;
    }

    private static void clearDownload(Context context) {
        SharedPreferences state = context.getSharedPreferences(STORE, MODE_PRIVATE);
        long id = state.getLong(DOWNLOAD, -1);
        if (id != -1) {
            try { context.getSystemService(DownloadManager.class).remove(id); }
            catch (RuntimeException ignored) { }
        }
        state.edit().clear().apply();
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        version = getIntent().getIntExtra(VERSION, 0);
        try {
            if (version <= getPackageManager().getPackageInfo(getPackageName(), 0).versionCode) {
                finish();
                return;
            }
        } catch (PackageManager.NameNotFoundException e) { finish(); return; }
        downloads = getSystemService(DownloadManager.class);
        store = getSharedPreferences(STORE, MODE_PRIVATE);
        if (store.getInt(VERSION, version) != version) clearDownload(this);
        downloadId = store.getLong(DOWNLOAD, -1);
        awaiting = saved == null ? 0 : saved.getInt("awaiting");
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_VERTICAL);
        int padding = (int)(28 * getResources().getDisplayMetrics().density);
        panel.setPadding(padding, padding, padding, padding);
        panel.setBackgroundColor(Color.rgb(247, 248, 244));
        TextView title = new TextView(this);
        title.setText("อัปเดต Trash 2 cash");
        title.setTextSize(24);
        title.setTextColor(Color.rgb(25, 55, 43));
        panel.addView(title);
        status = new TextView(this);
        status.setPadding(0, padding / 2, 0, padding / 2);
        status.setText("กำลังเตรียมไฟล์อัปเดต…");
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        panel.addView(status);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        panel.addView(progress);
        retry = new Button(this);
        retry.setText("ลองอีกครั้ง");
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> {
            pausedForRetry = false;
            retry.setVisibility(View.GONE);
            progress.setVisibility(View.VISIBLE);
            checkDownload();
        });
        panel.addView(retry);
        setContentView(panel);
    }

    private String filename() { return "Trash-2-cash-" + version + ".apk"; }

    private void checkDownload() {
        if (isFinishing() || awaiting != 0 || pausedForRetry) return;
        try {
            if (downloadId == -1) {
                File folder = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (folder == null) throw new IllegalStateException();
                File previous = new File(folder, filename());
                if (previous.exists() && !previous.delete()) throw new IllegalStateException();
                Uri url = Uri.parse(MainActivity.START + "downloads/saleng-digital.apk?v=" + version);
                DownloadManager.Request request = new DownloadManager.Request(url)
                    .setTitle("Trash 2 cash")
                    .setMimeType("application/vnd.android.package-archive")
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, filename());
                downloadId = downloads.enqueue(request);
                store.edit().putInt(VERSION, version).putLong(DOWNLOAD, downloadId).apply();
            }
            try (Cursor row = downloads.query(new DownloadManager.Query().setFilterById(downloadId))) {
                if (row == null || !row.moveToFirst()) throw new IllegalStateException();
                int state = row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                if (state == DownloadManager.STATUS_FAILED) throw new IllegalStateException();
                if (state == DownloadManager.STATUS_SUCCESSFUL) {
                    prepareInstaller();
                    return;
                }
                status.setText(state == DownloadManager.STATUS_PAUSED ? "กำลังรอระบบดาวน์โหลด…" : "กำลังดาวน์โหลดอัปเดต…");
                long total = row.getLong(row.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                long done = row.getLong(row.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                progress.setIndeterminate(total <= 0);
                if (total > 0) progress.setProgress((int)(done * 100 / total));
            }
            handler.postDelayed(check, 600);
        } catch (RuntimeException e) {
            clearDownload(this);
            downloadId = -1;
            showRetry("ดาวน์โหลดอัปเดตไม่สำเร็จ ตรวจอินเทอร์เน็ตและพื้นที่ว่าง แล้วลองอีกครั้ง");
        }
    }

    private void prepareInstaller() {
        PackageManager pm = getPackageManager();
        File apk = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename());
        PackageInfo next = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        try {
            PackageInfo current = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            if (next == null || !getPackageName().equals(next.packageName) || next.versionCode != version
                    || next.versionCode <= current.versionCode || current.signatures == null
                    || current.signatures.length == 0 || !Arrays.equals(current.signatures, next.signatures)) {
                clearDownload(this);
                downloadId = -1;
                showRetry("ตรวจสอบไฟล์อัปเดตไม่ได้ กรุณาลองอีกครั้ง");
                return;
            }
            if (!pm.canRequestPackageInstalls()) {
                status.setText("อนุญาตให้ Trash 2 cash ติดตั้งอัปเดต แล้วกลับมาที่แอป");
                awaiting = SETTINGS;
                startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())), SETTINGS);
                return;
            }
            Uri file = downloads.getUriForDownloadedFile(downloadId);
            if (file == null) throw new IllegalStateException();
            Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE, file);
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            status.setText("ยืนยันการอัปเดตในหน้าต่างของ Android");
            awaiting = INSTALL;
            startActivityForResult(install, INSTALL);
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            awaiting = 0;
            showRetry("เปิดหน้าติดตั้งของ Android ไม่สำเร็จ");
        }
    }

    private void showRetry(String text) {
        pausedForRetry = true;
        status.setText(text);
        progress.setVisibility(View.GONE);
        retry.setVisibility(View.VISIBLE);
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        awaiting = 0;
        if (code == SETTINGS && !getPackageManager().canRequestPackageInstalls()) {
            showRetry("หากต้องการติดตั้งอัปเดต ให้เปิดสิทธิ์ติดตั้งแอปจากแหล่งนี้");
        } else if (code == INSTALL) {
            if (result == RESULT_OK) finish();
            else showRetry("ยังไม่ได้ติดตั้งอัปเดต แตะลองอีกครั้งเมื่อต้องการติดตั้ง");
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (!isFinishing()) handler.post(check);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(check);
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putInt("awaiting", awaiting);
    }
}
