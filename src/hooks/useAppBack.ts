import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function useAppBack(fallback: string) {
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1)
      return
    }

    navigate(fallback, { replace: true })
  }, [fallback, location.key, navigate])
}
