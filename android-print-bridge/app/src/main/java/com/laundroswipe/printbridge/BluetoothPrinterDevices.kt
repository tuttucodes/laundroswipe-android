package com.laundroswipe.printbridge

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice

object BluetoothPrinterDevices {

    fun isLikelyThermalPrinter(device: BluetoothDevice): Boolean {
        val bc = device.bluetoothClass ?: return false
        if (bc.majorDeviceClass == BluetoothClass.Device.Major.IMAGING) return true
        val name = device.name?.lowercase().orEmpty()
        return name.contains("printer") ||
            name.contains("pos") ||
            name.contains("rpp") ||
            name.contains("mtp") ||
            name.contains("thermal") ||
            name.contains("receipt") ||
            name.contains("esc") ||
            name.contains("star") ||
            name.contains("epson")
    }

    @SuppressLint("MissingPermission")
    fun pairedRows(adapter: BluetoothAdapter?): List<PairedDeviceRow> {
        val set = adapter?.bondedDevices ?: return emptyList()
        return set.map { device ->
            val label = device.name?.trim().takeIf { it.isNotEmpty() } ?: "Unknown device"
            PairedDeviceRow(
                name = label,
                address = normalizeDisplayAddress(device.address),
                isLikelyPrinter = isLikelyThermalPrinter(device),
            )
        }.sortedWith(
            compareByDescending<PairedDeviceRow> { it.isLikelyPrinter }
                .thenBy { it.name.lowercase() },
        )
    }

    private fun normalizeDisplayAddress(address: String): String {
        val u = address.uppercase().replace("-", ":").trim()
        if (!u.contains(":") && u.length == 12 && u.matches(Regex("^[0-9A-F]{12}$"))) {
            return u.chunked(2).joinToString(":")
        }
        return u
    }
}
