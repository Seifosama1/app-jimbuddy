package com.jimbuddy.gymtracker;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final int[] SURFACE_FLUSH_DELAYS_MS = {
            0, 16, 50, 100, 200, 350, 600, 900, 1300
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                holdWebViewInSoftwareLayer(webView);
                scheduleSurfaceFlushBurst(webView);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                holdWebViewInSoftwareLayer(webView);
                scheduleSurfaceFlushBurst(webView);
            }
        });

        super.onCreate(savedInstanceState);
        scheduleSurfaceFlushBurst(getBridge() != null ? getBridge().getWebView() : null);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            scheduleSurfaceFlushBurst(getBridge() != null ? getBridge().getWebView() : null);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleSurfaceFlushBurst(getBridge() != null ? getBridge().getWebView() : null);
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
