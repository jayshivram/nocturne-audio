package com.nocturne.audio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(StoragePermissionPlugin.class);
        registerPlugin(NotificationPermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
