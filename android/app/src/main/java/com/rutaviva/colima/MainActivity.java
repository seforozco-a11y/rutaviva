package com.rutaviva.colima;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Debe registrarse ANTES de super.onCreate() para que el puente
        // exponga RutaVivaNative (abrir Ajustes de la app / del GPS).
        registerPlugin(RutaVivaNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
