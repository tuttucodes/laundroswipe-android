package com.laundroswipe.printbridge

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection
import com.dantsu.escposprinter.exceptions.EscPosConnectionException
import java.util.concurrent.Executors

/**
 * WebView → [DantSu/ESCPOS-ThermalPrinter-Android](https://github.com/DantSu/ESCPOS-ThermalPrinter-Android)
 * [BluetoothConnection]: SPP connect, then [DeviceConnection.write] + [DeviceConnection.send] for raw ESC/POS from the web app.
 */
class PrintBridge(private val appContext: Context) {

    private val executor = Executors.newSingleThreadExecutor()

    @Volatile
    private var connection: BluetoothConnection? = null

    @Volatile
    private var deviceAddress: String? = null

    private fun bluetoothAdapter(): BluetoothAdapter? {
        val bm = appContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return bm?.adapter
    }

    /**
     * Pair the printer in Android Bluetooth settings first, then set its MAC (e.g. 00:11:22:33:44:55).
     */
    @SuppressLint("MissingPermission")
    fun setPairedPrinterAddress(mac: String?) {
        deviceAddress = mac
        executor.execute {
            try {
                connection?.disconnect()
            } catch (_: Exception) {
            }
            connection = null
            if (mac.isNullOrBlank()) return@execute
            try {
                val dev = bluetoothAdapter()?.getRemoteDevice(mac) ?: return@execute
                val conn = BluetoothConnection(dev)
                conn.connect()
                connection = conn
                Log.i(TAG, "DantSu BluetoothConnection ready: $mac")
            } catch (e: EscPosConnectionException) {
                Log.e(TAG, "Bluetooth connect failed", e)
            } catch (e: Exception) {
                Log.e(TAG, "Bluetooth connect failed", e)
            }
        }
    }

    @JavascriptInterface
    fun printEscPosBase64(base64: String): Boolean {
        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            return false
        }
        val conn = connection
        if (conn == null || !conn.isConnected) {
            Log.w(TAG, "Printer not connected (MAC=$deviceAddress)")
            return false
        }
        executor.execute {
            try {
                conn.write(bytes)
                val waitMs = (bytes.size / 16).coerceIn(0, 2000)
                conn.send(waitMs)
            } catch (e: EscPosConnectionException) {
                Log.e(TAG, "Print send failed", e)
            } catch (e: Exception) {
                Log.e(TAG, "Print send failed", e)
            }
        }
        return true
    }

    companion object {
        private const val TAG = "LaundroSwipePrint"
    }
}
