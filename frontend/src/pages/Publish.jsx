import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, InputNumber, DatePicker, Button, Card, Row, Col, Select, App, Switch, Divider, Alert } from 'antd'
import { PlusOutlined, MinusCircleOutlined, SafetyCertificateOutlined, CheckCircleFilled } from '@ant-design/icons'
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
  const [hasCertification, setHasCertification] = useState(false)

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

    let certification = null
    if (hasCertification) {
      try {
        const allValues = await form.validateFields(['agency', 'certificateNo', 'certDate', 'conclusion', 'description'])
        certification = {
          agency: allValues.agency,
          certificateNo: allValues.certificateNo,
          certDate: allValues.certDate ? allValues.certDate.format('YYYY-MM-DD') : null,
          conclusion: allValues.conclusion,
          description: allValues.description
        }
      } catch (e) {
        message.warning('请完整填写鉴定证书信息')
        return
      }
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
        buyNowPrice: values.buyNow ? values.buyNowPrice : null,
        certification
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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
      <Card className="luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 20 }}>发布拍卖品</span>}>
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="提供专业鉴定证书可显著提高买家信任度和成交率"
          style={{ marginBottom: 24, background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.2)', color: '#b8b8b8' }}
        />
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ category: '其他', buyNow: false }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="title" label="拍品标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input size="large" placeholder="请输入拍品标题" maxLength={100} showCount className="luxury-input" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="图片URL列表">
                <div>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Input placeholder={`图片URL ${idx + 1}`} value={img} onChange={(e) => updateImage(idx, e.target.value)} className="luxury-input" />
                      {images.length > 1 && <Button icon={<MinusCircleOutlined />} type="text" danger onClick={() => removeImage(idx)} />}
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={addImage} style={{ borderColor: 'rgba(212, 175, 55, 0.3)', color: '#d4af37' }}>添加图片</Button>
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
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入起拍价" className="luxury-input" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="minIncrement" label="最低加价幅度 (¥)" rules={[{ required: true, message: '请输入加价幅度' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="每次出价最低增加金额" className="luxury-input" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="deposit" label="保证金 (¥)" rules={[{ required: true, message: '请输入保证金' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="出价前需冻结的金额" className="luxury-input" />
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
                <InputNumber min={1} style={{ width: '100%' }} placeholder="开启一口价后填写" className="luxury-input" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#d4af37' }}><SafetyCertificateOutlined /> 鉴定证书（选填）</span>
              </Divider>
            </Col>

            <Col span={24} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#f5f5f5' }}>本拍品是否有专业鉴定证书？</span>
                <Switch
                  checked={hasCertification}
                  onChange={(v) => {
                    setHasCertification(v)
                    if (!v) form.resetFields(['agency', 'certificateNo', 'certDate', 'conclusion', 'description'])
                  }}
                />
                {hasCertification && <span style={{ color: '#d4af37' }}><CheckCircleFilled /> 将显示"已鉴定"金色认证标识</span>}
              </div>
            </Col>

            {hasCertification && (
              <>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="agency"
                    label="鉴定机构"
                    rules={[{ required: true, message: '请输入鉴定机构名称' }]}
                  >
                    <Input placeholder="例如：国家珠宝玉石质量监督检验中心" className="luxury-input" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="certificateNo"
                    label="证书编号"
                    rules={[{ required: true, message: '请输入证书编号' }]}
                  >
                    <Input placeholder="请输入证书编号" className="luxury-input" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="certDate"
                    label="鉴定日期"
                    rules={[{ required: true, message: '请选择鉴定日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.valueOf() > Date.now()} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="conclusion"
                    label="鉴定结论"
                    rules={[{ required: true, message: '请输入鉴定结论' }]}
                  >
                    <Select placeholder="请选择或输入结论">
                      <Option value="真品，品相完好">真品，品相完好</Option>
                      <Option value="真品，有轻微使用痕迹">真品，有轻微使用痕迹</Option>
                      <Option value="经鉴定为A货">经鉴定为A货</Option>
                      <Option value="符合描述标准">符合描述标准</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label="鉴定详细描述">
                    <Input.TextArea rows={3} placeholder="请补充鉴定的详细说明，如材质、规格、瑕疵等（选填）" maxLength={500} showCount className="luxury-input" />
                  </Form.Item>
                </Col>
              </>
            )}

            <Col span={24}>
              <Form.Item label="商品描述 (富文本)" required>
                <div style={{ border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: 6 }}>
                  <div style={{ padding: 8, borderBottom: '1px solid rgba(212, 175, 55, 0.15)', background: 'rgba(212, 175, 55, 0.05)' }}>
                    {toolbarBtn('bold', 'B')}
                    {toolbarBtn('italic', 'I')}
                    {toolbarBtn('underline', 'U')}
                    {toolbarBtn('strikeThrough', 'S')}
                    <span style={{ margin: '0 8px', color: 'rgba(212, 175, 55, 0.3)' }}>|</span>
                    {toolbarBtn('insertUnorderedList', '• 列表')}
                    {toolbarBtn('insertOrderedList', '1. 列表')}
                    <span style={{ margin: '0 8px', color: 'rgba(212, 175, 55, 0.3)' }}>|</span>
                    {toolbarBtn('formatBlock', 'H1', 'h1')}
                    {toolbarBtn('formatBlock', 'H2', 'h2')}
                    {toolbarBtn('formatBlock', '正文', 'p')}
                    <span style={{ margin: '0 8px', color: 'rgba(212, 175, 55, 0.3)' }}>|</span>
                    {toolbarBtn('justifyLeft', '左对齐')}
                    {toolbarBtn('justifyCenter', '居中')}
                    {toolbarBtn('justifyRight', '右对齐')}
                  </div>
                  <div
                    ref={setEditorRef}
                    contentEditable
                    onInput={(e) => setHtml(e.target.innerHTML)}
                    suppressContentEditableWarning
                    style={{ minHeight: 200, padding: 12, outline: 'none', color: '#f5f5f5' }}
                    placeholder="请输入商品详细描述..."
                  />
                </div>
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item>
                <Button type="primary" size="large" htmlType="submit" loading={loading} className="gold-btn" style={{ width: 220, height: 48, fontSize: 16 }}>
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
