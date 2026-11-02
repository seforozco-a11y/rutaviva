package com.rutaviva.colima;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pequeño puente nativo propio de RutaViva: abre las pantallas de Ajustes de
 * Android para que el usuario pueda reactivar el permiso de ubicación o el
 * GPS cuando el diálogo del sistema ya no aparece (denegación permanente).
 *
 * Se registra en MainActivity antes de super.onCreate().
 */
@CapacitorPlugin(name = "RutaVivaNative")
public class RutaVivaNativePlugin extends Plugin {

    /** Ajustes → Aplicaciones → RutaViva → Permisos → Ubicación. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null)
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivitySafely(intent);
        call.resolve(new JSObject().put("opened", true));
    }

    /** Pantalla del sistema para activar/desactivar la Ubicación (GPS). */
    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivitySafely(intent);
        call.resolve(new JSObject().put("opened", true));
    }

    private void startActivitySafely(Intent intent) {
        if (getActivity() != null) {
            getActivity().startActivity(intent);
        } else {
            getContext().startActivity(intent);
        }
    }
}
