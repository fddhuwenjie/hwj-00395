import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, InputNumber, DatePicker, Button, Card, Row, Col, Select, App, Switch } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api.js'

const Publish = ({ user }) => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [html, setHtml] = useState('')
  const [editorRef, setEditorRef] = useState(null)
  const [images, setImages] = useState([''])

  useEffect(() => {
    if (!user) {
      message.warning('请先登录')
      navigate('/login')
    }
  }, [user])

  const execCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value)
    if (editorRef) {
      setHtml(editorRef.innerHTML)
      editorRef.focus()
    }
  }

  const categories = ['古董', '艺术品', '数码', '珠宝', '奢侈品', '收藏品', '乐器', '稀有书籍', '运动纪念品', '时尚单品', '其他']

  const handleSubmit = async (values) => {
    const imgs = images.filter(i => i && i.trim())
    if (imgs.length === 0) {
      message.warning('请至少填写一张图片URL')
      return
    }
    const descHtml = editorRef ? editorRef.innerHTML : html
    if (!descHtml || descHtml === '<br>' || descHtml === '') {
      message.warning('请填写商品描述')
      return
    }
    if (!values.startTime || !values.endTime) {
      message.warning('请选择开始和结束时间')
      return
    }
    if (values.startTime.valueOf() >= values.endTime.valueOf()) {
      message.warning('结束时间必须晚于开始时间')
      return
    }
    if (values.buyNow && !values.buyNowPrice) {
      message.warning('请填写一口价金额')
      return
    }
    setLoading(true)
    try {
      const data = {
        title: values.title,
        description: descHtml,
        images: imgs,
        category: values.category,
        startPrice: values.startPrice,
        minIncrement: values.minIncrement,
        deposit: values.deposit,
        startTime: values.startTime.valueOf(),
        endTime: values.endTime.valueOf(),
        buyNowPrice: values.buyNow ? values.buyNowPrice : null
      }
      const res = await api.post('/auctions', data)
      message.success('发布成功')
      navigate(`/auction/${res.id}`)
    } catch (e) {
      message.error(e.error || '发布失败')
    } finally {
      setLoading(false)
    }
  }

  const addImage = () => setImages([...images, ''])
  const removeImage = (idx) => {
    if (images.length === 1) return
    setImages(images.filter((_, i) => i !== idx))
  }
  const updateImage = (idx, val) => {
    const arr = [...images]
    arr[idx] = val
    setImages(arr)
  }

  const toolbarBtn = (cmd, label, value = null) => (
    <Button size="small" onClick={() => execCommand(cmd, value)} style={{ marginRight: 4 }}>{label}</Button>
  )

  if (!user) return null

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
      <Card title="发布拍卖品">
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ category: '其他', buyNow: false }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="title" label="拍品标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input size="large" placeholder="请输入拍品标题" maxLength={100} showCount />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="图片URL列表">
                <div>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Input placeholder={`图片URL ${idx + 1}`} value={img} onChange={(e) => updateImage(idx, e.target.value)} />
                      {images.length > 1 && <Button icon={<MinusCircleOutlined />} type="text" danger onClick={() => removeImage(idx)} />}
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={addImage}>添加图片</Button>
                </div>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select options={categories.map(c => ({ label: c, value: c }))} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="startPrice" label="起拍价 (¥)" rules={[{ required: true, message: '请输入起拍价' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入起拍价" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="minIncrement" label="最低加价幅度 (¥)" rules={[{ required: true, message: '请输入加价幅度' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="每次出价最低增加金额" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="deposit" label="保证金 (¥)" rules={[{ required: true, message: '请输入保证金' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="出价前需冻结的金额" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} showNow disabledDate={(d) => d && d.valueOf() < Date.now() - 86400000} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} showNow disabledDate={(d) => d && d.valueOf() < Date.now()} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="buyNow" label="支持一口价" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="buyNowPrice" label="一口价金额 (¥)">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="开启一口价后填写" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="商品描述 (富文本)" required>
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
                  <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                    {toolbarBtn('bold', 'B')}
                    {toolbarBtn('italic', 'I')}
                    {toolbarBtn('underline', 'U')}
                    {toolbarBtn('strikeThrough', 'S')}
                    <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
                    {toolbarBtn('insertUnorderedList', '• 列表')}
                    {toolbarBtn('insertOrderedList', '1. 列表')}
                    <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
                    {toolbarBtn('formatBlock', 'H1', 'h1')}
                    {toolbarBtn('formatBlock', 'H2', 'h2')}
                    {toolbarBtn('formatBlock', '正文', 'p')}
                    <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
                    {toolbarBtn('justifyLeft', '左对齐')}
                    {toolbarBtn('justifyCenter', '居中')}
                    {toolbarBtn('justifyRight', '右对齐')}
                  </div>
                  <div
                    ref={setEditorRef}
                    contentEditable
                    onInput={(e) => setHtml(e.target.innerHTML)}
                    suppressContentEditableWarning
                    style={{ minHeight: 200, padding: 12, outline: 'none' }}
                    placeholder="请输入商品详细描述..."
                  />
                </div>
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item>
                <Button type="primary" size="large" htmlType="submit" loading={loading} style={{ width: 200 }}>
                  发布拍品
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  )
}

export default Publish
