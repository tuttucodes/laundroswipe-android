package com.laundroswipe.printbridge

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.laundroswipe.printbridge.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var printBridge: PrintBridge
    private lateinit var deviceAdapter: BluetoothDevicePickerAdapter

    private var webViewInitialized = false

    private val requestBtPerms = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        if (hasBluetoothPermission()) {
            onReadyUi()
        } else {
            Toast.makeText(this, R.string.toast_bt_permission, Toast.LENGTH_LONG).show()
            setContentViewFallbackNoBtPermission()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        printBridge = PrintBridge(applicationContext)

        if (!hasBluetoothPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestBtPerms.launch(
                    arrayOf(Manifest.permission.BLUETOOTH_CONNECT),
                )
            } else {
                onReadyUi()
            }
            return
        }
        onReadyUi()
    }

    private fun hasBluetoothPermission(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.BLUETOOTH_CONNECT,
            ) == PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    private fun setContentViewFallbackNoBtPermission() {
        inflateAndWireChrome()
        binding.setupScroll.visibility = View.GONE
        binding.webContainer.visibility = View.VISIBLE
        initWebViewIfNeeded()
    }

    private fun inflateAndWireChrome() {
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)
        binding.toolbar.inflateMenu(R.menu.main_menu)
        binding.toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.menu_change_printer) {
                showSetupUi()
                true
            } else {
                false
            }
        }

        deviceAdapter = BluetoothDevicePickerAdapter { row ->
            binding.btnContinue.isEnabled = row != null
        }
        binding.deviceList.layoutManager = LinearLayoutManager(this)
        binding.deviceList.adapter = deviceAdapter

        binding.btnRefreshDevices.setOnClickListener { loadBondedDevices() }
        binding.btnOpenBtSettings.setOnClickListener {
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
        }
        binding.btnEnterMac.setOnClickListener { showManualMacDialog() }
        binding.btnContinue.setOnClickListener { onContinueClicked() }
    }

    private fun onReadyUi() {
        inflateAndWireChrome()

        val saved = resolvedSavedMac()
        if (saved.isNotEmpty()) {
            printBridge.setPairedPrinterAddress(saved)
            showWebUi()
        } else {
            showSetupUi()
        }
    }

    private fun resolvedSavedMac(): String {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val fromStrings = getString(R.string.printer_bluetooth_mac).trim()
        val fromPrefs = prefs.getString(KEY_PRINTER_MAC, "")?.trim().orEmpty()
        return when {
            fromStrings.isNotEmpty() && fromStrings != MAC_PLACEHOLDER -> normalizeMac(fromStrings)
            fromPrefs.isNotEmpty() -> normalizeMac(fromPrefs)
            else -> ""
        }
    }

    private fun showSetupUi() {
        binding.setupScroll.visibility = View.VISIBLE
        binding.webContainer.visibility = View.GONE
        loadBondedDevices()
    }

    private fun showWebUi() {
        binding.setupScroll.visibility = View.GONE
        binding.webContainer.visibility = View.VISIBLE
        initWebViewIfNeeded()
    }

    @SuppressLint("MissingPermission")
    private fun loadBondedDevices() {
        if (!hasBluetoothPermission()) {
            deviceAdapter.submitList(emptyList())
            binding.emptyState.visibility = View.VISIBLE
            return
        }
        val bm = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter: BluetoothAdapter? = bm?.adapter
        val rows = BluetoothPrinterDevices.pairedRows(adapter)
        deviceAdapter.submitList(rows)
        binding.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE

        val saved = resolvedSavedMac()
        if (saved.isNotEmpty()) {
            deviceAdapter.selectByAddress(saved)
        }
    }

    private fun onContinueClicked() {
        val row = deviceAdapter.selectedRow()
        if (row == null) {
            Toast.makeText(this, R.string.toast_select_printer, Toast.LENGTH_SHORT).show()
            return
        }
        val mac = normalizeMac(row.address)
        if (!isPlausibleMac(mac)) {
            Toast.makeText(this, R.string.toast_invalid_mac, Toast.LENGTH_LONG).show()
            return
        }
        persistMac(mac)
        printBridge.setPairedPrinterAddress(mac)
        Toast.makeText(this, R.string.toast_printer_saved, Toast.LENGTH_SHORT).show()
        showWebUi()
    }

    private fun persistMac(mac: String) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(KEY_PRINTER_MAC, mac)
            .apply()
    }

    private fun showManualMacDialog() {
        val input = EditText(this).apply {
            hint = getString(R.string.mac_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            val existing = resolvedSavedMac()
            if (existing.isNotEmpty()) setText(existing)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.dialog_manual_mac_title)
            .setMessage(R.string.dialog_manual_mac_message)
            .setView(input)
            .setPositiveButton(R.string.dialog_save) { _, _ ->
                val raw = input.text?.toString()?.trim().orEmpty()
                val normalized = normalizeMac(raw)
                if (!isPlausibleMac(normalized)) {
                    Toast.makeText(this, R.string.toast_invalid_mac, Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                persistMac(normalized)
                printBridge.setPairedPrinterAddress(normalized)
                Toast.makeText(this, R.string.toast_printer_saved, Toast.LENGTH_SHORT).show()
                binding.btnContinue.isEnabled = true
                showWebUi()
            }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initWebViewIfNeeded() {
        if (webViewInitialized) return
        webViewInitialized = true
        val wv: WebView = binding.webview
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.addJavascriptInterface(printBridge, "LaundroSwipeAndroidPrint")
        wv.webViewClient = WebViewClient()
        wv.loadUrl(getString(R.string.web_load_url))
    }

    private fun normalizeMac(s: String): String {
        var t = s.uppercase().replace("-", ":").replace(Regex("\\s+"), "")
        if (!t.contains(":") && t.length == 12 && t.matches(Regex("^[0-9A-F]{12}$"))) {
            t = t.chunked(2).joinToString(":")
        }
        return t
    }

    private fun isPlausibleMac(mac: String): Boolean {
        if (mac.length < 11) return false
        return mac.matches(Regex("^([0-9A-F]{2}:){5}[0-9A-F]{2}$"))
    }

    companion object {
        private const val PREFS_NAME = "laundro_swipe_print_bridge"
        private const val KEY_PRINTER_MAC = "bluetooth_printer_mac"
        private const val MAC_PLACEHOLDER = "00:00:00:00:00:00"
    }
}
