import { describe, expect, it } from 'vitest'
import { getCenteredImageCropSourceRect } from './imageCrop'

describe('image crop helpers', () => {
  it('crops a wide image to the requested centered ratio', () => {
    expect(getCenteredImageCropSourceRect(1600, 900, 1)).toEqual({
      sx: 350,
      sy: 0,
      sw: 900,
      sh: 900,
    })
  })

  it('crops a tall image to the requested centered ratio', () => {
    expect(getCenteredImageCropSourceRect(900, 1600, 16 / 9)).toEqual({
      sx: 0,
      sy: 546.875,
      sw: 900,
      sh: 506.25,
    })
  })

  it('zooms into the centered crop area', () => {
    expect(getCenteredImageCropSourceRect(1000, 1000, 1, 2)).toEqual({
      sx: 250,
      sy: 250,
      sw: 500,
      sh: 500,
    })
  })

  it('pans the crop area with normalized offsets', () => {
    expect(getCenteredImageCropSourceRect(1000, 1000, 1, 2, 1, -1)).toEqual({
      sx: 500,
      sy: 0,
      sw: 500,
      sh: 500,
    })
  })

  it('clamps unsafe crop offsets', () => {
    expect(getCenteredImageCropSourceRect(1000, 1000, 1, 2, 10, -10)).toEqual({
      sx: 500,
      sy: 0,
      sw: 500,
      sh: 500,
    })
  })
})
