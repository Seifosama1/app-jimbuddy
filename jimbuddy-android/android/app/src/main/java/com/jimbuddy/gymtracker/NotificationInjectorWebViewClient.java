package com.jimbuddy.gymtracker;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import javax.net.ssl.HttpsURLConnection;

/**
 * Custom WebViewClient that intercepts the main HTML page request,
 * fetches the HTML ourselves, injects the native notification bridge
 * script into the <head>, and returns the modified HTML.
 *
 * This is the ONLY reliable way to inject JavaScript that runs BEFORE
 * the page's own scripts when loading from a remote URL in Capacitor.
 * evaluateJavascript() in onPageStarted runs too late - the page's
 * scripts execute before the queued script.
 *
 * The injected script creates a mock window.Notification that delegates
 * to AndroidNotificationBridge (our @JavascriptInterface).
 */
public class NotificationInjectorWebViewClient extends WebViewClient {

    private static final String TAG = "NotifInjector";

    private final WebViewClient originalClient;
    private final NativeNotificationBridge notificationBridge;

    // This script is injected into the HTML <head> and runs BEFORE any other scripts.
    // It creates window.Notification as a mock that delegates to the native bridge.
    private static final String INJECTION_SCRIPT =
        "<script id=\"__jb_notif_bridge\">" +
        "(function(){" +
        "if(window.__jb_notif_ready)return;" +
        "window.__jb_notif_ready=true;" +
        "if(!('Notification' in window)){" +
        "var N=function(t,o){" +
        "  try{" +
        "    var b=window.AndroidNotificationBridge;" +
        "    if(b){" +
        "      b.showNotification(t||'Jim Buddy',(o&&o.body)||'',(o&&o.tag)||'jimbuddy-hydration',0);" +
        "    }else{" +
        "      console.warn('[NotifBridge] Native bridge not ready yet');" +
        "    }" +
        "  }catch(e){}" +
        "};" +
        "N.permission='granted';" +
        "N.requestPermission=function(c){" +
        "  var b=window.AndroidNotificationBridge;" +
        "  if(b && b.hasPermission()){" +
        "    if(typeof c==='function')c('granted');" +
        "    return Promise.resolve('granted');" +
        "  }" +
        "  if(b) b.requestPermission();" +
        "  if(typeof c==='function')c('granted');" +
        "  return Promise.resolve('granted');" +
        "};" +
        "window.Notification=N;" +
        "}" +
        "console.log('[JB] Native notification bridge ready immediately');" +
        "})();" +
        "</script>";

    public NotificationInjectorWebViewClient(WebViewClient originalClient,
                                              NativeNotificationBridge notificationBridge) {
        this.originalClient = originalClient;
        this.notificationBridge = notificationBridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        String method = request.getMethod();

        // Only intercept GET requests for main HTML pages
        if (!"GET".equals(method)) {
            return delegateToOriginal(request);
        }

        if (isMainHtmlRequest(url)) {
            Log.d(TAG, "Intercepting main HTML request: " + url);

            // Try the original Capacitor client first
            WebResourceResponse originalResponse = null;
            if (originalClient != null) {
                try {
                    originalResponse = originalClient.shouldInterceptRequest(view, request);
                } catch (Exception e) {
                    Log.w(TAG, "Original client threw: " + e.getMessage());
                }
            }

            // If the original client returned a response with data, inject into it
            if (originalResponse != null && originalResponse.getData() != null) {
                WebResourceResponse injected = injectIntoResponse(originalResponse);
                if (injected != null) return injected;
            }

            // For remote URLs, Capacitor's client doesn't intercept.
            // We fetch the HTML ourselves and inject our script.
            if (url.startsWith("http://") || url.startsWith("https://")) {
                return fetchAndInject(url);
            }
        }

        return delegateToOriginal(request);
    }

    /**
     * Check if this URL is a main HTML page request.
     */
    private boolean isMainHtmlRequest(String url) {
        try {
            android.net.Uri uri = android.net.Uri.parse(url);
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) {
                return true; // Root index
            }
            String lastSegment = uri.getLastPathSegment();
            if (lastSegment == null) return true;
            if (lastSegment.endsWith(".html") || lastSegment.endsWith(".htm")) {
                return true;
            }
            // If it doesn't contain a dot in the last path segment, it's a folder/route (no file extension)
            return !lastSegment.contains(".");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Fetch the HTML from a remote URL, inject our script, and return the modified response.
     */
    private WebResourceResponse fetchAndInject(String urlString) {
        HttpURLConnection connection = null;
        Log.d(TAG, "Fetching remote HTML: " + urlString);
        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,*/*");
            connection.setRequestProperty("User-Agent", System.getProperty("http.agent", "Mozilla/5.0"));

            connection.connect();

            int responseCode = connection.getResponseCode();
            Log.d(TAG, "Response code: " + responseCode);

            if (responseCode != HttpURLConnection.HTTP_OK) {
                // Don't intercept non-200 responses
                return null;
            }

            String contentType = connection.getContentType();
            String mimeType = "text/html";
            String encoding = "UTF-8";

            if (contentType != null) {
                String[] parts = contentType.split(";");
                if (parts.length > 0) mimeType = parts[0].trim();
                for (String part : parts) {
                    part = part.trim();
                    if (part.toLowerCase().startsWith("charset=")) {
                        encoding = part.substring(8).trim();
                    }
                }
            }

            // Only inject into HTML responses
            if (!mimeType.contains("html")) {
                // Return the original stream
                InputStream stream = connection.getInputStream();
                return new WebResourceResponse(mimeType, encoding, stream);
            }

            // Read the HTML content
            InputStream stream = connection.getInputStream();
            byte[] originalBytes = readAllBytes(stream);
            String html = new String(originalBytes, encoding);

            // Don't inject if already injected
            if (html.contains("__jb_notif_bridge")) {
                Log.d(TAG, "Already injected, returning original");
                return new WebResourceResponse(mimeType, encoding,
                    new ByteArrayInputStream(originalBytes));
            }

            // Inject our script at the end of <head> (before </head>)
            // This ensures it runs before any scripts that are in or after <head>
            String modifiedHtml;
            if (html.contains("</head>")) {
                modifiedHtml = html.replace("</head>", INJECTION_SCRIPT + "</head>");
            } else if (html.contains("</body>")) {
                modifiedHtml = html.replace("</body>", INJECTION_SCRIPT + "</body>");
            } else {
                // No head or body tags - prepend our script
                modifiedHtml = INJECTION_SCRIPT + html;
            }

            byte[] modifiedBytes = modifiedHtml.getBytes(encoding);
            Log.d(TAG, "Injected notification bridge script into HTML (" +
                  modifiedBytes.length + " bytes)");

            return new WebResourceResponse(mimeType, encoding,
                new ByteArrayInputStream(modifiedBytes));

        } catch (javax.net.ssl.SSLException e) {
            Log.e(TAG, "SSL error fetching " + urlString + ": " + e.getMessage());
            return null;
        } catch (java.net.SocketTimeoutException e) {
            Log.e(TAG, "Timeout fetching " + urlString);
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Error fetching " + urlString + ": " + e.getClass().getName() + " - " + e.getMessage());
            return null;
        } finally {
            if (connection != null) {
                try { connection.disconnect(); } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Read the original HTML response, inject our script, and return modified response.
     */
    private WebResourceResponse injectIntoResponse(WebResourceResponse originalResponse) {
        try {
            InputStream originalStream = originalResponse.getData();
            if (originalStream == null) return null;

            byte[] originalBytes = readAllBytes(originalStream);
            String html = new String(originalBytes, StandardCharsets.UTF_8);

            // Don't inject if already injected
            if (html.contains("__jb_notif_bridge")) {
                Log.d(TAG, "Already injected (local), returning original");
                return originalResponse;
            }

            String modifiedHtml;
            if (html.contains("</head>")) {
                modifiedHtml = html.replace("</head>", INJECTION_SCRIPT + "</head>");
            } else if (html.contains("</body>")) {
                modifiedHtml = html.replace("</body>", INJECTION_SCRIPT + "</body>");
            } else {
                modifiedHtml = INJECTION_SCRIPT + html;
            }

            byte[] modifiedBytes = modifiedHtml.getBytes(StandardCharsets.UTF_8);
            String mimeType = originalResponse.getMimeType();
            if (mimeType == null) mimeType = "text/html";
            String encoding = originalResponse.getEncoding();
            if (encoding == null) encoding = "UTF-8";

            return new WebResourceResponse(mimeType, encoding,
                new ByteArrayInputStream(modifiedBytes));
        } catch (Exception e) {
            Log.e(TAG, "Inject failed: " + e.getMessage());
            return null;
        }
    }

    private byte[] readAllBytes(InputStream stream) throws Exception {
        java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
        byte[] data = new byte[8192];
        int n;
        while ((n = stream.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, n);
        }
        return buffer.toByteArray();
    }

    private WebResourceResponse delegateToOriginal(WebResourceRequest request) {
        if (originalClient != null) {
            try {
                return originalClient.shouldInterceptRequest(null, request);
            } catch (Exception ignored) {}
        }
        return null;
    }

    // Delegate remaining WebViewClient methods to the original
    @Override
    public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
        if (originalClient != null) {
            try { originalClient.onPageStarted(view, url, favicon); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        if (originalClient != null) {
            try { originalClient.onPageFinished(view, url); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request,
                                android.webkit.WebResourceError error) {
        if (originalClient != null) {
            try { originalClient.onReceivedError(view, request, error); } catch (Exception ignored) {}
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (originalClient != null) {
            try { return originalClient.shouldOverrideUrlLoading(view, request); } catch (Exception ignored) {}
        }
        return false;
    }
}