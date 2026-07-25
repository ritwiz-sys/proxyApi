import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth.js'
import supabase from '../lib/supabase.js'

const router = Router()

// POST /api/alerts
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      city_name, country, lat, lon,
      temp_above, temp_below, aqi_above, humidity_above, wind_above
    } = req.body

    const user_id = req.user.id

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id,
        city_name,
        country,
        lat,
        lon,
        temp_above,
        temp_below,
        aqi_above,
        humidity_above,
        wind_above
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)

  } catch (error) {
    console.error('Create alert error FULL:', error)
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    res.status(500).json({ error: message })
  }
})

// GET /api/alerts
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.status(200).json(data)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fetch alerts error:', message)
    res.status(500).json({ error: 'Failed to fetch alerts' })
  }
})

// PATCH /api/alerts/:id
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id
    const { id } = req.params

    const updates: Record<string, unknown> = {}

    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active
    if (req.body.temp_above !== undefined) updates.temp_above = req.body.temp_above
    if (req.body.temp_below !== undefined) updates.temp_below = req.body.temp_below
    if (req.body.aqi_above !== undefined) updates.aqi_above = req.body.aqi_above
    if (req.body.humidity_above !== undefined) updates.humidity_above = req.body.humidity_above
    if (req.body.wind_above !== undefined) updates.wind_above = req.body.wind_above

    const { data, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single()

    if (error) throw error
    res.status(200).json(data)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update alert error:', message)
    res.status(500).json({ error: 'Failed to update alert' })
  }
})

// DELETE /api/alerts/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id
    const { id } = req.params

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)

    if (error) throw error
    res.status(200).json({ success: true, message: 'Alert deleted' })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Delete alert error:', message)
    res.status(500).json({ error: 'Failed to delete alert' })
  }
})

export default router