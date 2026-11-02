import { Droplets, Hexagon, Mountain, Snowflake, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react'

/** Plain-language card copy for each SolMate dimension and the NASA data behind it (see docs/DATA_SOURCES.md). */
export const DIMENSION_CARDS: { id: string; short: string; icon: LucideIcon; sources: string }[] = [
  { id: 'T', short: 'Terrain', icon: Mountain, sources: 'SRTMGL30 slope and relief; 100 m ASTER GDEM v3' },
  { id: 'C', short: 'Climate', icon: Droplets, sources: 'NASA POWER rain, humidity and evaporation (aridity P/PET)' },
  { id: 'Th', short: 'Thermal', icon: Thermometer, sources: 'MODIS Aqua land surface temperature (MYD11C3)' },
  { id: 'S', short: 'Surface', icon: Sun, sources: 'MODIS land cover (MCD12C1) and albedo (MCD43C3)' },
  { id: 'M', short: 'Minerals', icon: Hexagon, sources: 'ASTER GED thermal-infrared emissivity indices' },
  { id: 'I', short: 'Ice', icon: Snowflake, sources: 'MODIS snow cover (MOD10CM); NASA POWER frost days' },
  { id: 'D', short: 'Dust', icon: Wind, sources: 'MERRA-2 dust optical depth; NASA POWER wind (Mars only)' },
]
