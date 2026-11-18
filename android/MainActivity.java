package app.salengdigital.demo;

import android.app.Activity;
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

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/";
    private static final int PICK_IMAGE = 1, SAVE_CSV = 2;
    private WebView web;
    private ValueCallback<Uri[]> imageResult;
    private String pendingCsv;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(25, 55, 43));
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
                String path = uri.getPath();
                if (isLocal(uri) && "GET".equals(request.getMethod()) && path != null &&
                        !path.contains("..") && !path.contains("\\")) {
                    String name = path.equals("/") ? "index.html" : path.substring(1);
                    try {
                        InputStream file = getAssets().open("web/" + name);
                        return new WebResourceResponse(mime(name), "UTF-8", 200, "OK",
                            Collections.singletonMap("Content-Security-Policy",
                                "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'"), file);
                    } catch (IOException ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
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
        if (state == null || web.restoreState(state) == null) web.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getAuthority());
    }

    private static String mime(String name) {
        if (name.endsWith(".js")) return "application/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webmanifest")) return "application/manifest+json";
        return "text/plain";
    }

    private final class DeviceActions {
        @JavascriptInterface public void printPage() {
            runOnUiThread(() -> {
                PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                String title = "Saleng Digital";
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
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
