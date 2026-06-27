import { describe, it, expect, vi } from 'vitest'
import {
  isImageFile,
  hasImageFiles,
  handleImageFiles,
} from './handleImageUpload'
import type { Editor } from '@tiptap/core'

/**
 * handleImageUpload 的单元测试。
 *
 * 这一层是纯逻辑(文件判定 + 串行上传调度),不依赖真实编辑器,
 * 用最小 mock 覆盖各分支:空输入、非图片、上传成功/失败、串行顺序。
 */

// 构造一个满足 handleImageFiles 调用链的最小 editor mock:
// editor.chain().focus().setImage({src}).run()
function makeEditorMock() {
  const inserted: { src: string }[] = []
  const chain = {
    focus() {
      return chain
    },
    setImage(_attrs: { src: string }) {
      return chain
    },
    run() {
      inserted.push /* 占位,真正 push 在 setImage 捕获 */
      return true
    },
  }
  // 用 spy 记录每次 setImage 的入参,run 时落盘
  const setImageSpy = vi.fn((attrs: { src: string }) => {
    inserted.push(attrs)
    return chain
  })
  const editor = {
    chain: () => ({
      focus: () => ({
        setImage: setImageSpy,
        run: () => true,
      }),
    }),
  } as unknown as Editor
  return { editor, setImageSpy, inserted }
}

function file(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('isImageFile', () => {
  it('识别图片 MIME', () => {
    expect(isImageFile(file('a.png', 'image/png'))).toBe(true)
    expect(isImageFile(file('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isImageFile(file('a.gif', 'image/gif'))).toBe(true)
  })

  it('拒绝非图片 MIME', () => {
    expect(isImageFile(file('a.pdf', 'application/pdf'))).toBe(false)
    expect(isImageFile(file('a.txt', 'text/plain'))).toBe(false)
    expect(isImageFile(file('a.mp4', 'video/mp4'))).toBe(false)
  })

  it('只认 MIME 不认扩展名(防伪装)', () => {
    // 扩展名是 png 但 MIME 是 text → 判为非图片
    expect(isImageFile(file('a.png', 'text/plain'))).toBe(false)
  })
})

describe('hasImageFiles', () => {
  it('空输入返回 false', () => {
    expect(hasImageFiles(null)).toBe(false)
    expect(hasImageFiles(undefined)).toBe(false)
    expect(hasImageFiles([])).toBe(false)
  })

  it('纯文本文件返回 false', () => {
    const files = [file('a.txt', 'text/plain'), file('b.md', 'text/markdown')]
    expect(hasImageFiles(files)).toBe(false)
  })

  it('含图片返回 true', () => {
    const files = [file('a.txt', 'text/plain'), file('b.png', 'image/png')]
    expect(hasImageFiles(files)).toBe(true)
  })

  it('全图片返回 true', () => {
    const files = [file('a.png', 'image/png'), file('b.jpg', 'image/jpeg')]
    expect(hasImageFiles(files)).toBe(true)
  })

  it('接受 FileList 形态(粘贴/拖拽事件的真实形态)', () => {
    const list = {
      0: file('a.png', 'image/png'),
      length: 1,
      item: (_i: number) => file('a.png', 'image/png'),
    } as unknown as FileList
    expect(hasImageFiles(list)).toBe(true)
  })
})

describe('handleImageFiles', () => {
  it('空文件返回 false 且不调用上传', async () => {
    const upload = vi.fn()
    const { editor } = makeEditorMock()
    const result = await handleImageFiles([], upload, editor)
    expect(result).toBe(false)
    expect(upload).not.toHaveBeenCalled()
  })

  it('无 upload 函数返回 false', async () => {
    const { editor } = makeEditorMock()
    const result = await handleImageFiles(
      [file('a.png', 'image/png')],
      undefined,
      editor,
    )
    expect(result).toBe(false)
  })

  it('无图片文件返回 false(非图片不消费)', async () => {
    const upload = vi.fn()
    const { editor } = makeEditorMock()
    const result = await handleImageFiles(
      [file('a.pdf', 'application/pdf')],
      upload,
      editor,
    )
    expect(result).toBe(false)
    expect(upload).not.toHaveBeenCalled()
  })

  it('上传成功 → 调用 setImage 插入,返回 true', async () => {
    const upload = vi.fn().mockResolvedValue('https://cdn/a.png')
    const { editor, setImageSpy } = makeEditorMock()
    const result = await handleImageFiles(
      [file('a.png', 'image/png')],
      upload,
      editor,
    )
    expect(result).toBe(true)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(setImageSpy).toHaveBeenCalledWith({ src: 'https://cdn/a.png' })
  })

  it('单张失败不中断其余图片', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce('https://cdn/b.png')
    const { editor, setImageSpy } = makeEditorMock()
    const result = await handleImageFiles(
      [file('a.png', 'image/png'), file('b.png', 'image/png')],
      upload,
      editor,
    )
    // 仍返回 true(确实消费了图片文件,只是第一张失败了)
    expect(result).toBe(true)
    expect(upload).toHaveBeenCalledTimes(2)
    // 只有第二张成功插入
    expect(setImageSpy).toHaveBeenCalledTimes(1)
    expect(setImageSpy).toHaveBeenCalledWith({ src: 'https://cdn/b.png' })
  })

  it('upload 返回 null 时跳过插入但不报错', async () => {
    const upload = vi.fn().mockResolvedValue(null)
    const { editor, setImageSpy } = makeEditorMock()
    const result = await handleImageFiles(
      [file('a.png', 'image/png')],
      upload,
      editor,
    )
    expect(result).toBe(true)
    expect(setImageSpy).not.toHaveBeenCalled()
  })

  it('混合文件:只上传图片,跳过非图片', async () => {
    const upload = vi.fn().mockResolvedValue('https://cdn/x.png')
    const { editor, setImageSpy } = makeEditorMock()
    const result = await handleImageFiles(
      [
        file('a.txt', 'text/plain'),
        file('b.png', 'image/png'),
        file('c.pdf', 'application/pdf'),
      ],
      upload,
      editor,
    )
    expect(result).toBe(true)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(setImageSpy).toHaveBeenCalledWith({ src: 'https://cdn/x.png' })
  })

  it('返回值是 Promise<boolean>(验证修复 onPaste 误用的根因)', async () => {
    const { editor } = makeEditorMock()
    const ret = handleImageFiles([], vi.fn(), editor)
    // 关键:必须是 Promise,不能是同步 boolean
    // (旧 bug: if (handled) 把 Promise 当 truthy,误拦所有粘贴)
    expect(ret).toBeInstanceOf(Promise)
    expect(typeof (await ret)).toBe('boolean')
  })
})
