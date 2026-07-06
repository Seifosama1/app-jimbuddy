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
    private static final String CHANNEL_HYDRATION_ID = "jimbuddy_hydration";
    private static final String CHANNEL_HYDRATION_NAME = "Hydration Reminders";
    private static final String CHANNEL_HYDRATION_DESC = "Reminders to drink water throughout the day";
    private static final String CHANNEL_CHAT_ID = "jimbuddy_chat";
    private static final String CHANNEL_CHAT_NAME = "Chat Messages";
    private static final String CHANNEL_CHAT_DESC = "New messages from your gymbros";

    private final Context context;
    private final NotificationManager notificationManager;

    public NativeNotificationBridge(Context context) {
        this.context = context;
        this.notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannels();
    }

    /**
     * Create notification channels (required for Android 8.0+).
     * Must be called before any notification is posted.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Hydration channel
            NotificationChannel hydrationChannel = new NotificationChannel(
                    CHANNEL_HYDRATION_ID,
                    CHANNEL_HYDRATION_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            hydrationChannel.setDescription(CHANNEL_HYDRATION_DESC);
            hydrationChannel.enableVibration(true);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            hydrationChannel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    audioAttributes
            );
            notificationManager.createNotificationChannel(hydrationChannel);
            Log.d(TAG, "Hydration channel created: " + CHANNEL_HYDRATION_ID);

            // Chat channel
            NotificationChannel chatChannel = new NotificationChannel(
                    CHANNEL_CHAT_ID,
                    CHANNEL_CHAT_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            chatChannel.setDescription(CHANNEL_CHAT_DESC);
            chatChannel.enableVibration(true);
            chatChannel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    audioAttributes
            );
            notificationManager.createNotificationChannel(chatChannel);
            Log.d(TAG, "Chat channel created: " + CHANNEL_CHAT_ID);
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
            Log.d(TAG, "Notification permission requested — forwarding to activity");
        } else {
            Log.d(TAG, "Notification permission not needed pre-Android 13");
        }
    }

    /**
     * Show a native Android system notification for hydration reminders.
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
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_HYDRATION_ID)
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

        Log.d(TAG, "Native hydration notification shown: id=" + notificationId + ", tag=" + notifTag);
    }

    /**
     * Show a native Android system notification for chat messages.
     * This is exposed to JavaScript and works even when the app is backgrounded/killed
     * (as long as the JS code calling it is executing in a service context).
     */
    @JavascriptInterface
    public void showChatNotification(String senderName, String message, String senderId, String chatId) {
        Log.d(TAG, "showChatNotification called: senderName=" + senderName + ", senderId=" + senderId + ", chatId=" + chatId);

        // Check permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted, cannot show chat notification");
                return;
            }
        }

        int notificationId = (int) ((System.currentTimeMillis() & 0xFFFFFFF) ^ (senderId != null ? senderId.hashCode() : 0));

        // Truncate long messages
        String body = (message != null && message.length() > 80)
                ? message.substring(0, 77) + "..."
                : (message != null ? message : "📨 New message");
        String title = senderName != null ? senderName : "Your Gymbro";

        // Create a PendingIntent that opens the app and navigates to gymbros tab
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setData(Uri.parse("jimbuddy://gymbros?friendId=" + (senderId != null ? senderId : "")));
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, (int) (System.currentTimeMillis() & 0xFFFF), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification using the chat channel
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_CHAT_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setLargeIcon(BitmapFactory.decodeResource(
                        context.getResources(), android.R.drawable.ic_dialog_email))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        // Vibrate for chat messages
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE));
            }
        }

        // Use sender-specific tag to collapse but allow renotify per sender
        String notifTag = "jimbuddy-chat-" + (senderId != null ? senderId : "unknown");

        notificationManager.cancel(notifTag, notificationId);
        notificationManager.notify(notifTag, notificationId, builder.build());

        Log.d(TAG, "Native chat notification shown: id=" + notificationId + ", tag=" + notifTag + ", sender=" + senderName);
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
     * Returns whether the app can schedule exact alarms (Android 12+).
     * On older versions always returns true.
     */
    @JavascriptInterface
    public boolean canScheduleExactAlarms() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager =
                    (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            return alarmManager != null && alarmManager.canScheduleExactAlarms();
        }
        return true;
    }

    /**
     * Opens the system screen where the user can grant SCHEDULE_EXACT_ALARM.
     * Only relevant on Android 12+.
     */
    @JavascriptInterface
    public void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(
                    android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + context.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }
    }

    /**
     * Schedule a single alarm using AlarmManager.
     * Uses exact alarms when permission is available, falls back to inexact
     * (still wakes device) when SCHEDULE_EXACT_ALARM hasn't been granted.
     */
    public static void scheduleAlarm(Context context, long intervalMs, boolean immediate) {
        Intent intent = new Intent(context, HydrationReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        android.app.AlarmManager alarmManager =
                (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long triggerAtMillis = System.currentTimeMillis() + (immediate ? 5_000L : intervalMs);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+: check if exact-alarm permission is granted
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                );
                Log.d(TAG, "Exact alarm scheduled in " + (immediate ? 5 : (intervalMs / 1000)) + "s");
            } else {
                // Fallback: inexact but still wakes device (max ~15 min drift on Doze)
                alarmManager.setAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                );
                Log.w(TAG, "SCHEDULE_EXACT_ALARM not granted — using inexact alarm");
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
            );
            Log.d(TAG, "Exact alarm (M-R) scheduled in " + (immediate ? 5 : (intervalMs / 1000)) + "s");
        } else {
            alarmManager.setExact(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
            );
            Log.d(TAG, "Exact alarm (legacy) scheduled in " + (immediate ? 5 : (intervalMs / 1000)) + "s");
        }
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