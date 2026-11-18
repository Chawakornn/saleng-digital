package app.salengdigital.demo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String HOST = "saleng-digital.vercel.app";
    private static final String LEGACY = "https://appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/";
    private static final int PICK_IMAGE = 1, SAVE_CSV = 2;
    private WebView web;
    private ValueCallback<Uri[]> imageResult;
    private String pendingCsv;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(21, 63, 71));
        frame.setFitsSystemWindows(true);
        setContentView(frame);
        web = new WebView(this);
        frame.addView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new DeviceActions(), "SalengAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocal(uri)) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError(frame);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (imageResult != null) imageResult.onReceiveValue(null);
                imageResult = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*");
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/jpeg","image/png","image/webp"});
                try { startActivityForResult(pick, PICK_IMAGE); }
                catch (ActivityNotFoundException e) { imageResult.onReceiveValue(null); imageResult = null; }
                return true;
            }
        });
        if (state != null) pendingCsv = state.getString("pendingCsv");
        if (state == null || web.restoreState(state) == null || !isLocal(Uri.parse(String.valueOf(web.getUrl())))) web.loadUrl(START);
        String updated = UpdateActivity.finishInstalledUpdate(this);
        if (updated != null) message("อัปเดตเป็น " + updated + " แล้ว");
        offerLegacyCleanup();
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getAuthority());
    }

    private void showConnectionError(FrameLayout frame) {
        if (frame.getChildCount() > 1) return;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.rgb(250,248,243));
        TextView title = new TextView(this);
        title.setText("เชื่อมต่อ Trash 2 cash ไม่ได้");
        title.setTextSize(22);
        box.addView(title);
        TextView help = new TextView(this);
        help.setText("ตรวจอินเทอร์เน็ตแล้วลองเปิดบัญชีอีกครั้ง");
        box.addView(help);
        Button retry = new Button(this);
        retry.setText("ลองอีกครั้ง");
        retry.setOnClickListener(v -> { frame.removeView(box); web.loadUrl(START); });
        box.addView(retry);
        frame.addView(box, new FrameLayout.LayoutParams(-1,-1));
    }

    private void offerLegacyCleanup() {
        if (getPreferences(MODE_PRIVATE).getBoolean("legacyReviewed",false)) return;
        // This isolated WebView only opens inline HTML at the old, app-owned origin.
        WebView old = new WebView(this);
        old.getSettings().setJavaScriptEnabled(true);
        old.getSettings().setDomStorageEnabled(true);
        old.getSettings().setBlockNetworkLoads(true);
        old.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("Boolean(localStorage.getItem('saleng-showcase-db-1'))", exists -> {
                    if (isFinishing() || !"true".equals(exists)) { old.destroy(); return; }
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("พบข้อมูลสาธิตจากรุ่นเดิม")
                        .setMessage("ข้อมูลนี้อยู่ในเครื่องและแยกจากบัญชีใหม่ ต้องการลบรายการและรูปสาธิตในเครื่องนี้หรือไม่?")
                        .setNegativeButton("เก็บไว้", (dialog,which) -> { markLegacyReviewed(); old.destroy(); })
                        .setPositiveButton("ลบข้อมูลเดิม", (dialog,which) ->
                            old.evaluateJavascript("Object.keys(localStorage).filter(k=>k==='saleng-role'||k==='saleng-showcase-db-1'||k.startsWith('saleng-image-')).forEach(k=>localStorage.removeItem(k))",
                                result -> { markLegacyReviewed(); old.destroy(); }))
                        .setOnCancelListener(dialog -> old.destroy()).show();
                });
            }
        });
        old.loadDataWithBaseURL(LEGACY+"/","<html></html>","text/html","UTF-8",null);
    }

    private void markLegacyReviewed() {
        getPreferences(MODE_PRIVATE).edit().putBoolean("legacyReviewed",true).apply();
    }

    private final class DeviceActions {
        @JavascriptInterface public int getVersionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (PackageManager.NameNotFoundException e) { return 0; }
        }

        @JavascriptInterface public String downloadUpdate(int version) {
            if (version <= getVersionCode()) return "current";
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, UpdateActivity.class)
                .putExtra(UpdateActivity.VERSION, version)));
            return "installer";
        }

        @JavascriptInterface public void printPage() {
            runOnUiThread(() -> {
                PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                String title = "Trash 2 cash";
                manager.print(title, web.createPrintDocumentAdapter(title), null);
            });
        }

        @JavascriptInterface public void saveCsv(String csv) {
            runOnUiThread(() -> {
                if (pendingCsv != null) return;
                pendingCsv = csv;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/csv");
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.putExtra(Intent.EXTRA_TITLE, "รายการขาย.csv");
                try { startActivityForResult(save, SAVE_CSV); }
                catch (ActivityNotFoundException e) { pendingCsv = null; message("เปิดตัวเลือกไฟล์ไม่ได้"); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (uri != null && !"content".equals(uri.getScheme())) uri = null;
        if (request == PICK_IMAGE && imageResult != null) {
            imageResult.onReceiveValue(uri == null ? null : new Uri[]{uri});
            imageResult = null;
        } else if (request == SAVE_CSV) {
            String csv = pendingCsv;
            pendingCsv = null;
            if (uri == null || csv == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("No output stream");
                out.write(csv.getBytes(StandardCharsets.UTF_8));
                message("บันทึกไฟล์ CSV แล้ว");
            } catch (IOException | SecurityException e) { message("บันทึกไฟล์ CSV ไม่สำเร็จ"); }
        }
    }

    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        web.saveState(state);
        state.putString("pendingCsv", pendingCsv);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){const d=document.querySelector('#workspace-menu[open]');if(d){d.close();return true;}return false;})()", handled -> {
            if ("true".equals(handled)) return;
            if (web.canGoBack()) web.goBack();
            else super.onBackPressed();
        });
    }
}
