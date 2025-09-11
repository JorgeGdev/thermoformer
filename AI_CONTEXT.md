# Plixies Production Dashboard - AI Assistant Context

## Project Overview
Plixies is a thermoforming company in New Zealand that manufactures plastic products. This dashboard system tracks production in real-time and includes an AI assistant for querying production data.

## Production Process

### Equipment
- **2 Thermoformers**: TH1 and TH2
- **Available Sizes**: 22, 25, 27, 30 (ONLY these sizes - NO 15 or 20)
- **Pallet Capacity**: Each pallet contains exactly 24 packets

### Shifts
- **DS (Day Shift)**: 6:00 - 14:30
- **TW (Twilight)**: 14:30 - 23:00  
- **NS (Night Shift)**: 23:00 - 6:00 (crosses midnight)

### Timezone
- **Pacific/Auckland (New Zealand)** - All timestamps and dates use NZ time

## Database Structure

### Core Tables

#### 1. `sizes` - Available Product Sizes
- Contains ONLY: 22, 25, 27, 30
- **IMPORTANT**: Sizes 15 and 20 do NOT exist in the system

#### 2. `packets` - Individual Production Records  
- Each packet gets a unique ISO number per size
- Fields: `iso_number`, `size`, `thermoformer_number`, `shift`, `raw_materials`, `batch_number`, `box_number`, `pallet_id`, `packet_index` (1-24), `created_at`

#### 3. `pallets` - Production Pallets
- Each pallet holds up to 24 packets
- Global pallet numbering across all sizes and thermoformers
- Fields: `pallet_number` (global), `size`, `thermoformer_number`, `opened_at`, `closed_at`

#### 4. `raw_pallets` - Raw Material Inventory
- Physical pallets of raw materials (different from production pallets)
- Each starts with 4 rolls, `rolls_used` decreases as consumed
- Fields: `supplier`, `pallet_no`, `stock_code`, `batch_number`, `sticker_date`, `rolls_total`, `rolls_used`

#### 5. `rolls` - Scanned Roll Data
- Individual rolls scanned during intake process
- Fields: `thermoformer_number`, `raw_materials`, `batch_number`, `box_number`, `photo_path`

### Key Business Rules

1. **ISO Numbers**: Unique per size, not global (Size 22 can have ISO 1000, Size 25 can also have ISO 1000)
2. **Pallet Numbers**: Global counter across all sizes and thermoformers
3. **Packet Indexing**: 1-24 within each pallet
4. **Auto-Close**: Pallets automatically close when reaching 24 packets
5. **Raw Material**: Each raw pallet starts with 4 rolls

## AI Assistant Guidelines

### Critical Rules for AI Responses
- **NEVER mention sizes 15 or 20** - they don't exist
- **ALWAYS use real sizes**: 22, 25, 27, 30
- Use data from database queries, not assumptions
- Explain that ISO numbers are unique per size, not global
- Clarify difference between production pallets (24 packets) and raw pallets (material inventory)

### Common Query Types
- Production statistics (daily, shift-based, size-based)
- Pallet status (open/closed, progress to 24)
- Raw material inventory levels
- ISO number tracking and generation
- Thermoformer performance comparisons
- Shift performance analysis

### Data Sources
- Real-time queries to Supabase database
- All times in Pacific/Auckland timezone
- Current production data updated continuously

## File Structure
- `/src/pages/api/ai-chat.ts` - AI Assistant API endpoint
- `/src/react/DBChat.tsx` - Chat interface component
- `/src/pages/get-db-chat.astro` - Chat page
- Database schema defined in attached SQL files

This context ensures the AI assistant provides accurate, real-time information about Plixies production operations using only valid data and business rules.
