package com.jimbuddy.gymtracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.Calendar;

public class HydrationReminderReceiver extends BroadcastReceiver {
    private static final String TAG = "HydrationReminderRecv";
    private static final String CHANNEL_ID = "jimbuddy_hydration";
    private static final String PREFS_NAME = "jimbuddy_notification_prefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "onReceive triggered with action: " + action);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (!enabled) {
            Log.d(TAG, "Reminders are disabled in preferences. Skipping.");
            return;
        }

        long intervalMs = prefs.getLong("intervalMs", 3600 * 1000);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            Log.d(TAG, "Rescheduling hydration alarm after system boot/package update.");
            NativeNotificationBridge.scheduleAlarm(context, intervalMs, false);
            return;
        }

        // Check if current time is within start/end time
        String startTime = prefs.getString("startTime", "08:00");
        String endTime = prefs.getString("endTime", "22:00");
        Calendar now = Calendar.getInstance();
        int hour = now.get(Calendar.HOUR_OF_DAY);
        int minute = now.get(Calendar.MINUTE);
        String currentTime = String.format("%02d:%02d", hour, minute);

        if (currentTime.compareTo(startTime) >= 0 && currentTime.compareTo(endTime) <= 0) {
            String title = prefs.getString("title", "💧 Jim Buddy");
            String message = prefs.getString("message", "Time to hydrate!");
            showNotification(context, title, message);
        } else {
            Log.d(TAG, "Current time " + currentTime + " is outside active hours " + startTime + " - " + endTime + ". Skipping notification.");
        }

        // Reschedule the next alarm
        NativeNotificationBridge.scheduleAlarm(context, intervalMs, false);
    }

    private void showNotification(Context context, String title, String message) {
        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Hydration Reminders",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Reminders to drink water throughout the day");
            channel.enableVibration(true);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            channel.setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    audioAttributes
            );
            notificationManager.createNotificationChannel(channel);
        }

        int notificationId = (int) (System.currentTimeMillis() & 0xFFFFFFF);

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
        Intent logWaterIntent = new Intent(context, MainActivity.class);
        logWaterIntent.setAction("LOG_WATER_250");
        PendingIntent logWaterPendingIntent = PendingIntent.getActivity(
                context, 1, logWaterIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setLargeIcon(BitmapFactory.decodeResource(
                        context.getResources(), android.R.drawable.ic_dialog_info))
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        builder.addAction(
                android.R.drawable.ic_input_add,
                "💧 Log 250ml",
                logWaterPendingIntent
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE));
            }
        }

        notificationManager.notify("jimbuddy-hydration", notificationId, builder.build());
        Log.d(TAG, "Background notification shown successfully");
    }
}
