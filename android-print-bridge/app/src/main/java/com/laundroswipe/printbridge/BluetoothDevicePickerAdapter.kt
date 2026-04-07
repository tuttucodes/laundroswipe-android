package com.laundroswipe.printbridge

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.laundroswipe.printbridge.databinding.ItemBluetoothDeviceBinding

data class PairedDeviceRow(
    val name: String,
    val address: String,
    val isLikelyPrinter: Boolean,
)

class BluetoothDevicePickerAdapter(
    private val onSelectionChanged: (PairedDeviceRow?) -> Unit,
) : RecyclerView.Adapter<BluetoothDevicePickerAdapter.VH>() {

    private var items: List<PairedDeviceRow> = emptyList()
    private var selectedIndex: Int = RecyclerView.NO_POSITION

    fun submitList(newItems: List<PairedDeviceRow>) {
        items = newItems
        selectedIndex = RecyclerView.NO_POSITION
        notifyDataSetChanged()
        onSelectionChanged(null)
    }

    fun selectByAddress(mac: String) {
        val idx = items.indexOfFirst { it.address.equals(mac, ignoreCase = true) }
        if (idx < 0) return
        val prev = selectedIndex
        selectedIndex = idx
        if (prev != RecyclerView.NO_POSITION) notifyItemChanged(prev)
        notifyItemChanged(idx)
        onSelectionChanged(items[idx])
    }

    fun selectedRow(): PairedDeviceRow? =
        if (selectedIndex in items.indices) items[selectedIndex] else null

    override fun getItemCount(): Int = items.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val inflater = LayoutInflater.from(parent.context)
        val binding = ItemBluetoothDeviceBinding.inflate(inflater, parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position], position == selectedIndex)
    }

    inner class VH(
        private val binding: ItemBluetoothDeviceBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.root.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos == RecyclerView.NO_POSITION) return@setOnClickListener
                val prev = selectedIndex
                selectedIndex = pos
                if (prev != RecyclerView.NO_POSITION) notifyItemChanged(prev)
                notifyItemChanged(pos)
                onSelectionChanged(items.getOrNull(pos))
            }
        }

        fun bind(row: PairedDeviceRow, selected: Boolean) {
            binding.deviceName.text = row.name
            binding.deviceAddress.text = row.address
            binding.radio.isChecked = selected
            binding.printerHint.visibility =
                if (row.isLikelyPrinter) android.view.View.VISIBLE else android.view.View.GONE
            val c = binding.root.context
            val stroke = c.getColor(
                if (selected) R.color.ls_card_stroke_selected else R.color.ls_card_stroke_default,
            )
            binding.root.strokeColor = ColorStateList.valueOf(stroke)
            binding.root.strokeWidth = c.resources.getDimensionPixelSize(
                if (selected) R.dimen.card_stroke_selected else R.dimen.card_stroke_default,
            )
        }
    }
}
