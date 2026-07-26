package com.joulane.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if ("admin".equals(BuildConfig.FLAVOR) || "stock".equals(BuildConfig.FLAVOR)) {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        }
        super.onCreate(savedInstanceState);
    }
}
