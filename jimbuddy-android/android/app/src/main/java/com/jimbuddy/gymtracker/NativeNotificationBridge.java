package com.jimbuddy.gymtracker;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import android.webkit.JavascriptInterface;
import android.util.Log;

/**
 * Native Android Notification Bridge for Jim Buddy
 *
 * Provides @JavascriptInterface methods so the WebView JavaScript
 * can directly trigger native Android system notifications
 * (instead of relying on Chrome's Web Notification API which shows
 * Chrome-branded notifications on Android).
 */
public class NativeNotificationBridge {

    private static final String TAG = "NativeNotifBridge";
    private static final String CHANNEL_ID = "jimbuddy_hydration";
    private static final String CHANNEL_NAME = "Hydration Reminders";
    private static final String CHANNEL_DESC = "Reminders to drink water throughout the day";

    private final Context context;
    private final NotificationManager notificationManager;

    public NativeNotificationBridge(Context context) {
        this.context = context;
        this.notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    /**
     * Create the notification channel (required for Android 8.0+).
     * Must be called before any notification is posted.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableVibration(true);

            // Use the default notification sound
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            channel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    audioAttributes
            );

            notificationManager.createNotificationChannel(channel);
            Log.d(TAG, "Notification channel created: " + CHANNEL_ID);
        }
    }

    /**
     * Returns true if the app has notification permission.
     * On Android 12-, this always returns true.
     * On Android 13+, checks POST_NOTIFICATIONS.
     */
    @JavascriptInterface
    public boolean hasPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        // Pre-Android 13: notifications are always allowed
        return true;
    }

    /**
     * Called from JavaScript to request notification permission.
     * On Android 13+, opens the system permission dialog.
     * On earlier versions, permission is already granted.
     */
    @JavascriptInterface
    public void requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // We cannot show the system dialog directly from @JavascriptInterface.
            // Instead, we forward to the MainActivity which will handle the request.
            Log.d(TAG, "Notification permission requested — forwarding to activity");
        } else {
            Log.d(TAG, "Notification permission not needed pre-Android 13");
        }
    }

    /**
     * Show a native Android system notification for hydration reminders.
     *
     * @param title   Notification title (e.g., "💧 Jim Buddy")
     * @param message Notification body (e.g., "Time to hydrate! 1200/2000ml")
     * @param tag     Unique tag to group/collapse duplicate notifications
     * @param id      Numeric ID for the notification (use 0 for auto-increment)
     */
    /**
     * Show a native Android system notification for hydration reminders.
     *
     * @param title   Notification title (e.g., "💧 Jim Buddy")
     * @param message Notification body (e.g., "Time to hydrate! 1200/2000ml")
     * @param tag     Unique tag to group/collapse duplicate notifications
     * @param id      Numeric ID for the notification (use 0 for auto-increment)
     */
    @JavascriptInterface
    public void showNotification(String title, String message, String tag, int id) {
        Log.d(TAG, "showNotification called: title=" + title + ", message=" + message + ", tag=" + tag);

        // Check permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted, cannot show notification");
                return;
            }
        }

        int notificationId = (id > 0) ? id : (int) (System.currentTimeMillis() & 0xFFFFFFF);

        // Create a PendingIntent that opens the app when tapped
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            // Add a query param to navigate to the water tab
            intent.setData(Uri.parse("jimbuddy://water"));
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action: Log 250ml of water
        Intent logWaterIntent = new Intent(context, context.getClass());
        logWaterIntent.setAction("LOG_WATER_250");
        PendingIntent logWaterPendingIntent = PendingIntent.getActivity(
                context, 1, logWaterIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setLargeIcon(BitmapFactory.decodeResource(
                        context.getResources(), android.R.drawable.ic_dialog_info))
                .setContentTitle(title != null ? title : "💧 Jim Buddy")
                .setContentText(message != null ? message : "Time to hydrate!")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(message != null ? message : "Time to hydrate!"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        // Add action button for quick water logging
        builder.addAction(
                android.R.drawable.ic_input_add,
                "💧 Log 250ml",
                logWaterPendingIntent
        );

        // Vibrate for 500ms
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE));
            }
        }

        // Use tag to collapse duplicate notifications
        String notifTag = (tag != null && !tag.isEmpty()) ? tag : "jimbuddy-hydration";

        notificationManager.cancel(notifTag, notificationId);
        notificationManager.notify(notifTag, notificationId, builder.build());

        Log.d(TAG, "Native notification shown: id=" + notificationId + ", tag=" + notifTag);
    }

    /**
     * Set up background reminders scheduling using AlarmManager.
     * This keeps scheduling alarms even when the app is killed/backgrounded.
     */
    @JavascriptInterface
    public void setupBackgroundReminders(String title, String message, int intervalSeconds, String startTime, String endTime) {
        Log.d(TAG, "setupBackgroundReminders: intervalSec=" + intervalSeconds + ", start=" + startTime + ", end=" + endTime);
        
        SharedPreferences prefs = context.getSharedPreferences("jimbuddy_notification_prefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean("enabled", true);
        editor.putString("title", title);
        editor.putString("message", message);
        editor.putLong("intervalMs", (long) intervalSeconds * 1000);
        editor.putString("startTime", startTime);
        editor.putString("endTime", endTime);
        editor.apply();

        scheduleAlarm(context, (long) intervalSeconds * 1000, true);
    }

    /**
     * Cancel all background reminders in AlarmManager.
     */
    @JavascriptInterface
    public void cancelBackgroundReminders() {
        Log.d(TAG, "cancelBackgroundReminders called");
        SharedPreferences prefs = context.getSharedPreferences("jimbuddy_notification_prefs", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("enabled", false).apply();

        Intent intent = new Intent(context, HydrationReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
    }

    /**
     * Schedule a single alarm using AlarmManager.
     */
    public static void scheduleAlarm(Context context, long intervalMs, boolean immediate) {
        Intent intent = new Intent(context, HydrationReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long triggerAtMillis = System.currentTimeMillis() + (immediate ? 1000 : intervalMs);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
            );
        } else {
            alarmManager.setExact(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
            );
        }
        Log.d(TAG, "Alarm scheduled in " + (immediate ? 1 : (intervalMs / 1000)) + " seconds");
    }

    /**
     * Cancel a notification by tag.
     */
    @JavascriptInterface
    public void cancelNotification(String tag) {
        if (tag != null && !tag.isEmpty()) {
            notificationManager.cancel(tag, 0);
        }
    }

    /**
     * Cancel all notifications from this app.
     */
    @JavascriptInterface
    public void cancelAll() {
        notificationManager.cancelAll();
    }
}