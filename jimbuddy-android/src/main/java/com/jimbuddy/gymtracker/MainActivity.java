package com.jimbuddy.gymtracker;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private static final int[] SURFACE_FLUSH_DELAYS_MS = {
            0, 16, 50, 100, 200, 350, 600, 900, 1300
    };

    private NativeNotificationBridge notificationBridge;

    // Permission launcher for Android 13+ POST_NOTIFICATIONS
    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    Toast.makeText(this, "🔔 Notifications allowed!", Toast.LENGTH_SHORT).show();
                    notifyJsPermissionResult(true);
                } else {
                    Toast.makeText(this, "🔕 Notifications denied", Toast.LENGTH_SHORT).show();
                    notifyJsPermissionResult(false);
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // CRITICAL: Initialize the notification bridge BEFORE super.onCreate()
        // because super.onCreate() creates the WebView and triggers onPageStarted
        // synchronously. If we initialize after, the bridge is null when the
        // first page load fires.
        notificationBridge = new NativeNotificationBridge(this);

        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                holdWebViewInSoftwareLayer(webView);
                scheduleSurfaceFlushBurst(webView);

                // Add the JavascriptInterface BEFORE any page JS runs.
                // @JavascriptInterface objects are injected at the native level
                // and are available immediately to JavaScript.
                if (notificationBridge != null) {
                    webView.addJavascriptInterface(notificationBridge, "AndroidNotificationBridge");
                }

                // Inject the Notification mock polyfill early
                injectNotificationPolyfill(webView);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                holdWebViewInSoftwareLayer(webView);
                scheduleSurfaceFlushBurst(webView);

                // Re-inject on page load to ensure everything is set up
                if (notificationBridge != null) {
                    webView.addJavascriptInterface(notificationBridge, "AndroidNotificationBridge");
                }
                injectNotificationPolyfill(webView);
                patchExistingFunctions(webView);
            }
        });

        super.onCreate(savedInstanceState);

        // Wrap the Capacitor WebViewClient with our custom client that intercepts
        // HTML responses and injects the Notification mock script directly into
        // the HTML before the WebView parses it.
        setupNotificationWebViewClient();
    }

    /**
     * Wraps the Capacitor WebViewClient with our custom client.
     */
    private void setupNotificationWebViewClient() {
        getBridge().getWebView().post(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;

            WebViewClient currentClient = webView.getWebViewClient();
            webView.setWebViewClient(new NotificationInjectorWebViewClient(
                currentClient, notificationBridge
            ));
        });
    }

    /**
     * Injects the Notification mock polyfill via evaluateJavascript.
     * This creates window.Notification so the remote app.js check
     * "if (!('Notification' in window))" passes.
     */
    private void injectNotificationPolyfill(WebView webView) {
        if (webView == null) return;

        String script =
            "(function(){" +
            "if(window.__notifInstalled)return;" +
            "window.__notifInstalled=true;" +
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
            "console.log('[NotifBridge] Notification mock installed immediately');" +
            "}" +
            "})();";

        webView.evaluateJavascript(script, null);
    }

    /**
     * Patches existing functions like sendHydrationNotification, requestNotificationPermission
     * to use the native Android bridge.
     */
    private void patchExistingFunctions(WebView webView) {
        if (webView == null) return;

        String patchScript =
            "(function(){" +
            "if(window.__notifPatched)return;" +
            "var b=window.AndroidNotificationBridge;" +
            "if(!b){setTimeout(arguments.callee,100);return;}" +
            "window.__notifPatched=true;" +
            "console.log('[NotifBridge] Patching existing functions');" +
            // Patch sendHydrationNotification
            "var sf=setInterval(function(){if(typeof sendHydrationNotification==='function'){clearInterval(sf);var _s=sendHydrationNotification;sendHydrationNotification=function(msg){if(typeof toast==='function')toast(msg);if(typeof SoundManager!=='undefined'&&SoundManager.waterSplash)SoundManager.waterSplash();var wl=[],st={waterGoal:2000};try{var d=(typeof getData==='function')?getData():{};wl=d.waterLog||[];st=d.settings||{waterGoal:2000};}catch(e){}var t=new Date().toISOString().split('T')[0];var tw=wl.filter(function(l){return l.date&&l.date.startsWith(t);}).reduce(function(a,l){return a+l.amount;},0);var wg=st.waterGoal||2000;var p=Math.min(100,Math.round((tw/wg)*100));try{b.showNotification('Jim Buddy',msg+'\\n'+tw+' ml of '+wg+' ml ('+p+'% done)','jimbuddy-hydration',0);}catch(e){}};console.log('[NotifBridge] sendHydrationNotification patched');}},200);" +
            // Patch requestNotificationPermission
            "var rp=setInterval(function(){if(typeof requestNotificationPermission==='function'){clearInterval(rp);var _r=requestNotificationPermission;requestNotificationPermission=async function(){if(b.hasPermission()){if(typeof toast==='function')toast('Notifications allowed!');return true;}b.requestPermission();if(typeof toast==='function')toast('Notification permission requested');return true;};console.log('[NotifBridge] requestNotificationPermission patched');}},200);" +
            // Patch openHydrationReminderModal
            "var om=setInterval(function(){if(typeof openHydrationReminderModal==='function'){clearInterval(om);var _o=openHydrationReminderModal;openHydrationReminderModal=function(){_o();var se=document.getElementById('notif-permission-status');if(se){se.textContent=b.hasPermission()?'Native Android Notifications: ON':'Native Android Notifications: Will request on save';}};console.log('[NotifBridge] openHydrationReminderModal patched');}},200);" +
            "})();";

        webView.evaluateJavascript(patchScript, null);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            scheduleSurfaceFlushBurst(getBridge() != null ? getBridge().getWebView() : null);
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                if (notificationBridge != null) {
                    wv.addJavascriptInterface(notificationBridge, "AndroidNotificationBridge");
                }
                injectNotificationPolyfill(wv);
                patchExistingFunctions(wv);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleSurfaceFlushBurst(getBridge() != null ? getBridge().getWebView() : null);
    }

    /**
     * Check if POST_NOTIFICATIONS permission is needed (Android 13+).
     */
    public void checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
    }

    private void notifyJsPermissionResult(boolean granted) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        webView.evaluateJavascript(
            "(function(){ " +
            "  var evt = new CustomEvent('AndroidNotificationPermissionResult', { " +
            "    detail: { granted: " + granted + " } " +
            "  }); " +
            "  window.dispatchEvent(evt); " +
            "})();",
            null
        );
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;

        String action = intent.getAction();
        if ("LOG_WATER_250".equals(action)) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.evaluateJavascript(
                    "(function(){ " +
                    "  if(typeof addWater === 'function') { " +
                    "    addWater(250); " +
                    "    if(typeof navigate === 'function') navigate('water'); " +
                    "  } " +
                    "})();",
                    null
                );
            }
        }

        android.net.Uri data = intent.getData();
        if (data != null && "water".equals(data.getHost())) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.evaluateJavascript(
                    "(function(){ " +
                    "  if(typeof navigate === 'function') navigate('water'); " +
                    "})();",
                    null
                );
            }
        }
    }

    private void scheduleSurfaceFlushBurst(WebView webView) {
        for (int delayMs : SURFACE_FLUSH_DELAYS_MS) {
            getWindow().getDecorView().postDelayed(() -> invalidateAppSurface(webView), delayMs);
        }
    }

    private void holdWebViewInSoftwareLayer(WebView webView) {
        WebView targetWebView = webView != null
                ? webView
                : (getBridge() != null ? getBridge().getWebView() : null);
        if (targetWebView == null) return;

        targetWebView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        targetWebView.postDelayed(() -> {
            targetWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            targetWebView.invalidate();
            targetWebView.postInvalidateOnAnimation();
        }, 1400);
    }

    private void invalidateAppSurface(WebView webView) {
        View decorView = getWindow().getDecorView();
        WebView targetWebView = webView != null
                ? webView
                : (getBridge() != null ? getBridge().getWebView() : null);
        decorView.invalidate();
        decorView.postInvalidateOnAnimation();
        if (targetWebView != null) {
            targetWebView.requestLayout();
            targetWebView.invalidate();
            targetWebView.postInvalidateOnAnimation();
        }
    }
}